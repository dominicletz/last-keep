const { expect } = require("@playwright/test")
const fs = require("fs")
const path = require("path")

const proofDir = path.join("tmp", "verify-artifacts")

function prepareProof() {
  fs.mkdirSync(proofDir, { recursive: true })
}

function shot(name) {
  return path.join(proofDir, name)
}

function gameUrl(path) {
  const origin = (process.env.BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "")
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`
}

async function createHost(browser, name, hero) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(gameUrl("/"))
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll(".hero-card img.portrait")]
    return imgs.length === 5 && imgs.every((img) => img.complete && img.naturalHeight >= 64 && img.naturalHeight <= 128)
  })
  await page.locator("#player-name").fill(name)
  await page.locator(`input[value="${hero}"]`).check()
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction((who) => document.querySelector("[data-roster]")?.innerText?.includes(who), name)
  return { context, page }
}

async function joinQuery(browser, code, name, hero) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(gameUrl(`/r/${code}?name=${encodeURIComponent(name)}&hero=${hero}`))
  await page.waitForFunction((who) => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return roster.includes(who) && document.querySelector("#join-game")?.hidden
  }, name)
  return { context, page }
}

function watch(page, label, errors) {
  page.on("pageerror", (error) => errors.push(`${label} ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} ${message.text()}`)
  })
}

async function untilTick(page, ticks) {
  const start = await page.evaluate(() => window.__lastKeep.tick)
  await page.waitForFunction(
    (mark) => window.__lastKeep.tick - mark.start >= mark.ticks,
    { start, ticks },
    { timeout: 15_000 }
  )
}

async function peakAttackAcrossTicks(page, ticks) {
  const start = await page.evaluate(() => window.__lastKeep.tick)
  let peak = 0
  let seen = start
  while (seen - start < ticks) {
    await page.waitForFunction((mark) => window.__lastKeep.tick > mark, seen, { timeout: 15_000 })
    const row = await page.evaluate(() => ({
      tick: window.__lastKeep.tick,
      cd: window.__lastKeep.attackCd || 0
    }))
    peak = Math.max(peak, row.cd)
    seen = row.tick
  }
  return peak
}

async function focusClickDoesNotAttack(page) {
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.toClient(me.x + 20, me.y)
  })
  const tag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, spot)
  expect(tag).toBe("CANVAS")
  await page.evaluate(() => window.__lastKeepTest.blur())
  await page.mouse.click(spot.x, spot.y)
  // Melee cooldown is 8 ticks. A 350ms wall clock can end before an idle page
  // publishes that swing, so a real attack looks like a miss.
  const peak = await peakAttackAcrossTicks(page, 12)
  expect(peak).toBe(0)
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(wood)
  await page.mouse.click(spot.x, spot.y)
  await page.waitForFunction(() => window.__lastKeep.attackCd > 0)
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(wood)
}

async function clickDoesNotSpendWithoutABuilding(page) {
  const before = await page.evaluate(() => ({
    wood: window.__lastKeep.wood,
    buildings: window.__lastKeep.buildings
  }))
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.toClient(me.x + 48, me.y + 8)
  })
  await page.mouse.click(spot.x, spot.y)
  await untilTick(page, 8)
  const after = await page.evaluate(() => ({
    wood: window.__lastKeep.wood,
    buildings: window.__lastKeep.buildings
  }))
  expect(after).toEqual(before)
}

async function invalidPlacementExplains(page) {
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  await pressKey(page, "Digit1")
  const center = await page.evaluate(() => window.__lastKeep.toClient(0, 0))
  await page.mouse.move(center.x, center.y)
  await expect(page.locator("[data-build-reason]")).toContainText(/keep|Too close/)
  await page.screenshot({ path: shot("reason-host.png") })
  await page.mouse.click(center.x, center.y)
  await page.waitForFunction(() =>
    (window.__lastKeep.log || []).some((row) => row.type === "deny" && /keep|close|far|wood|gold|Blocked|many/i.test(row.text))
  )
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(wood)
  expect(await page.evaluate(() => window.__lastKeep.buildings)).toBe(0)
  // The deny holds for 2200ms of paint time. A fixed sleep ends before a late paint.
  await expect(page.locator("[data-build-reason]")).toBeHidden()
}

async function placeWall(page) {
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  const armed = await page.locator('[data-build="wall"]').evaluate((node) => node.classList.contains("on"))
  if (!armed) await pressKey(page, "Digit1")
  await page.evaluate(() => window.__lastKeepTest.blur())
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.toClient(me.x + 100, me.y + 36)
  })
  await page.mouse.click(spot.x, spot.y)
  await page.waitForFunction(
    (before) => window.__lastKeep.wood < before && window.__lastKeep.buildings >= 1,
    wood
  )
  await expect(page.locator('[data-build="wall"]')).not.toHaveClass(/\bon\b/)
  await page.screenshot({ path: shot("wall-host.png") })
}

async function expectGoblinsOnYard(page) {
  // redNear reads the framebuffer. Doing that on every poll stalls the page
  // while the server keeps biting, and the mage is dead before Q is held.
  // The shot assertion stays: one read, after the goblins are already in frame.
  // A page left in the background does not draw, so onScreen stays stale.
  await page.bringToFront()
  await page.waitForFunction(() => {
    const game = window.__lastKeep
    return (
      game.phase === "wave" &&
      game.monsters.length >= 2 &&
      game.monsters.every((monster) => monster.onScreen)
    )
  })
  const visible = await page.evaluate(() => {
    const game = window.__lastKeep
    return (game.monsters || []).some((monster) => game.redNear(monster.x, monster.y) > 8)
  })
  expect(visible).toBe(true)
  const edgeLabels = await page.locator("[data-hints]").innerText()
  expect(edgeLabels).not.toMatch(/goblin \d/)
  const { waveClock } = await import("../assets/js/hud.js")
  await expect(page.locator("[data-clock]")).toHaveText(waveClock)
  await expect(page.locator("[data-wave]")).toHaveText("Wave 1")
}

function blankNotes() {
  return {
    hit: false,
    death: false,
    digit: false,
    slain: false,
    boom: false,
    fireball: false,
    nan: false,
    rising: false,
    unstable: false,
    waves: []
  }
}

async function sample(tab, notes) {
  const row = await tab.evaluate(() => {
    const game = window.__lastKeep || {}
    const fx = document.querySelector("[data-fx]")?.innerText || ""
    const wave = document.querySelector("[data-wave]")?.innerText || ""
    const floaters = [...document.querySelectorAll("[data-fx] .floater")].map((node) => node.style.left)
    return {
      fx,
      wave,
      floaters,
      rising: [...document.querySelectorAll("[data-fx] .floater")].some((node) => {
        const style = getComputedStyle(node)
        const anim = node.getAnimations()[0]
        return parseFloat(style.fontSize) >= 24 && String(style.animationName).includes("float-up") && anim && anim.currentTime > 40
      }),
      log: game.log || [],
      kinds: game.kinds || [],
      projectiles: game.projectiles || []
    }
  })
  if (/next/i.test(row.wave)) notes.unstable = true
  if (row.wave) notes.waves.push(row.wave)
  if (/\d/.test(row.fx)) notes.digit = true
  if (row.fx.includes("Slain")) notes.slain = true
  if (row.fx.includes("Boom")) notes.boom = true
  if (row.floaters.some((left) => !left || left.includes("NaN"))) notes.nan = true
  if (row.rising) notes.rising = true
  for (const ev of row.log) {
    if (ev.type === "hit" && ev.amount > 0) notes.hit = true
    if (ev.type === "death") notes.death = true
    if (ev.type === "boom") notes.boom = true
  }
  if (row.kinds.includes("fireball") || row.projectiles.some((shot) => shot.kind === "fireball")) notes.fireball = true
}

async function castFireball(friend, notes) {
  await liveSnap(friend)
  const aim = await friend.evaluate(() => {
    const game = window.__lastKeep
    const me = game.self
    if (!me) return null
    return { point: game.toClient(0, 0), alive: me.alive === true, hp: me.hp }
  })
  expect(aim && aim.alive, `mage was down before the cast (${JSON.stringify(aim)})`).toBe(true)
  const viewport = friend.viewportSize()
  const point = aim.point
  if (
    point &&
    point.x > 8 &&
    point.y > 8 &&
    point.x < viewport.width - 8 &&
    point.y < viewport.height - 8
  ) {
    await friend.mouse.move(point.x, point.y)
  }
  // Hold the key until the shot is visible. An 80ms tap can be encoded after
  // the key is already up, so the server never sees the edge.
  await holdKey(friend, "KeyQ", true)
  const tickAtHold = await friend.evaluate(() => window.__lastKeep.tick)
  try {
    await friend.waitForFunction(
      () => {
        const game = window.__lastKeep
        const flying = (game.projectiles || []).some((shot) => shot.kind === "fireball")
        const seen = (game.kinds || []).includes("fireball")
        return flying || seen
      },
      null,
      { timeout: 5000 }
    )
  } catch (err) {
    const debug = await friend.evaluate((held) => ({
      cds: window.__lastKeep.cds,
      kinds: window.__lastKeep.kinds,
      projectiles: window.__lastKeep.projectiles,
      hero: window.__lastKeep.self && window.__lastKeep.self.hero,
      monsters: (window.__lastKeep.monsters || []).length,
      phase: window.__lastKeep.phase,
      tick: window.__lastKeep.tick,
      tickAtHold: held,
      hidden: document.visibilityState,
      alive: window.__lastKeep.self && window.__lastKeep.self.alive,
      hp: window.__lastKeep.self && window.__lastKeep.self.hp
    }), tickAtHold)
    throw new Error(`fireball was not on screen ${JSON.stringify(debug)} (${err.message})`)
  } finally {
    await holdKey(friend, "KeyQ", false)
  }
  await friend.waitForFunction(() => (window.__lastKeep.log || []).some((row) => row.type === "boom"), {
    timeout: 5_000
  })
  await sample(friend, notes)
  expect(notes.boom).toBe(true)
  await friend.screenshot({ path: shot("fireball-guest.png") })
}

async function fight(page, friend, notes) {
  const started = Date.now()
  let hostKey = null
  let guestKey = null
  while (Date.now() - started < 50_000) {
    const phase = await page.evaluate(() => window.__lastKeep.phase)
    if (phase !== "wave") break
    await sample(page, notes)
    await sample(friend, notes)
    if (notes.slain && !notes.combatShot) {
      await page.screenshot({ path: shot("combat-host.png") })
      notes.combatShot = true
    }
    hostKey = await step(page, hostKey)
    guestKey = await step(friend, guestKey)
    await page.waitForTimeout(200)
  }
  if (hostKey) await holdKey(page, hostKey, false)
  if (guestKey) await holdKey(friend, guestKey, false)
  await sample(page, notes)
  await sample(friend, notes)
}

async function liveSnap(page) {
  await page.bringToFront()
  await page.waitForFunction(() => document.visibilityState === "visible", null, { polling: 100 })
  await page.evaluate(() => {
    window.__lastKeepLive = null
  })
  await page.waitForFunction(
    () => {
      const tick = window.__lastKeep && window.__lastKeep.tick
      if (!Number.isFinite(tick)) return false
      const now = performance.now()
      const mark = window.__lastKeepLive
      if (!mark) {
        window.__lastKeepLive = { tick, at: now }
        return false
      }
      const dt = now - mark.at
      if (dt < 250) return false
      const steps = tick - mark.tick
      window.__lastKeepLive = { tick, at: now }
      const rate = (steps * 1000) / dt
      return rate >= 8 && rate <= 40
    },
    null,
    { polling: 100 }
  )
}

async function holdKey(page, code, down) {
  await page.evaluate(
    ({ code, down }) => {
      const active = document.activeElement
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) active.blur()
      if (window.__lastKeepTest) window.__lastKeepTest.hold(code, down)
      window.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", {
          code,
          key: code,
          bubbles: true,
          cancelable: true
        })
      )
    },
    { code, down }
  )
}

async function pressKey(page, code) {
  await holdKey(page, code, true)
  await page.waitForTimeout(80)
  await holdKey(page, code, false)
}

async function step(tab, held) {
  const plan = await tab.evaluate(() => {
    const game = window.__lastKeep
    const me = game.self
    if (!me) return null
    const monster = (game.monsters || []).slice().sort((a, b) => {
      return Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y)
    })[0]
    if (!monster) return null
    const dx = monster.x - me.x
    const dy = monster.y - me.y
    const dist = Math.hypot(dx, dy)
    const dirs = [
      ["KeyW", -1, -1],
      ["KeyS", 1, 1],
      ["KeyA", -1, 1],
      ["KeyD", 1, -1]
    ]
    let key = "KeyW"
    let best = -Infinity
    for (const [name, x, y] of dirs) {
      const score = x * dx + y * dy
      if (score > best) {
        best = score
        key = name
      }
    }
    return { key, dist, hero: me.hero, click: game.toClient(monster.x, monster.y) }
  })
  if (!plan) return held
  if (held && held !== plan.key) await holdKey(tab, held, false)
  if (plan.dist > 36) await holdKey(tab, plan.key, true)
  else if (held) await holdKey(tab, held, false)
  const viewport = tab.viewportSize()
  const inside =
    plan.click.x > 8 &&
    plan.click.y > 8 &&
    plan.click.x < viewport.width - 8 &&
    plan.click.y < viewport.height - 8
  if (inside) await tab.mouse.click(plan.click.x, plan.click.y)
  if (plan.hero === "mage") await pressKey(tab, "KeyQ")
  return plan.dist > 36 ? plan.key : null
}

function assertCombat(notes) {
  expect(notes.hit).toBe(true)
  expect(notes.digit).toBe(true)
  expect(notes.death).toBe(true)
  expect(notes.slain).toBe(true)
  expect(notes.fireball).toBe(true)
  expect(notes.boom).toBe(true)
  expect(notes.nan).toBe(false)
  expect(notes.rising).toBe(true)
}

function assertWaveStable(notes) {
  const nums = notes.waves.map((label) => Number(String(label).replace(/[^\d]/g, "")))
  expect(nums.length).toBeGreaterThan(0)
  for (let i = 1; i < nums.length; i += 1) expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1])
  expect(nums).toContain(1)
  expect(nums).toContain(2)
  expect(notes.unstable).toBe(false)
  expect(notes.waves.every((label) => /^Wave \d+$/.test(label))).toBe(true)
}

async function assertBonuses(page) {
  await expect(page.locator("[data-forge]")).toContainText("15%")
  await expect(page.locator("[data-spire]")).toContainText(/recover faster/)
  await expect(page.locator("[data-relics]")).toContainText(/relic/i)
  expect(await page.evaluate(() => window.__lastKeep.smoothing)).toBe(true)
}

async function assertDiegeticHud(page) {
  const report = await page.evaluate(() => {
    const alphaOf = (color) => {
      const match = String(color).match(/rgba?\(([^)]+)\)/)
      if (!match) return 0
      const parts = match[1].split(",").map((part) => Number(part.trim()))
      return parts.length < 4 ? 1 : parts[3]
    }
    const nameOf = (node) => {
      if (node.hasAttribute("data-stock")) return "stock"
      if (node.hasAttribute("data-bonuses")) return "relics"
      if (node.hasAttribute("data-roster")) return "roster"
      if (node.classList.contains("skill")) return "skill"
      if (node.classList.contains("build")) return "build"
      if (node.classList.contains("heart")) return "heart"
      if (node.classList.contains("chip")) return "wave"
      return "hud"
    }
    const nodes = [
      ...document.querySelectorAll(".chip, [data-bonuses], [data-stock], [data-roster], .skill, .build, .heart")
    ]
    const sacks = [...document.querySelectorAll(".sack")]
    const problems = []
    let area = 0
    for (const node of [...nodes, ...sacks]) {
      const style = getComputedStyle(node)
      const box = node.getBoundingClientRect()
      area += box.width * box.height
      const alpha = alphaOf(style.backgroundColor)
      const border = parseFloat(style.borderTopWidth) || 0
      const name = node.classList.contains("sack") ? "sack" : nameOf(node)
      if (alpha > 0.35) problems.push(`${name} fill`)
      if (border >= 2) problems.push(`${name} border`)
    }
    const chrome = document.querySelectorAll("[data-chrome]").length
    const world = document.querySelectorAll("[data-world]").length
    return { area: Math.round(area), count: nodes.length, chrome, world, sacks: sacks.length, problems }
  })
  expect(report.count).toBe(15)
  expect(report.sacks).toBe(3)
  expect(report.world).toBe(5)
  // Caption glass was these same 15 slots. Sacks, relic lines, the heart,
  // the roster, and the keep sign left it. The glass keeps 4 skills and 6 builds.
  expect(report.chrome).toBe(10)
  expect(report.chrome).toBeLessThan(15)
  expect(report.problems).toEqual([])
  // The same slots on opaque panels covered 150656px at 1280×800.
  expect(report.area).toBeLessThan(105000)
}

async function paradeShowsEveryKind(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  const page = host.page
  watch(page, "host", errors)
  await page.evaluate(() => window.__lastKeepTest.parade())
  await page.waitForFunction(() => {
    const kinds = new Set((window.__lastKeep.monsters || []).map((monster) => monster.kind))
    return ["goblin", "skeleton", "wolf", "troll", "bat", "boss"].every((kind) => kinds.has(kind))
  })
  const onScreen = await page.evaluate(() =>
    (window.__lastKeep.monsters || []).filter((monster) => monster.onScreen).map((monster) => monster.kind)
  )
  expect(new Set(onScreen)).toEqual(new Set(["goblin", "skeleton", "wolf", "troll", "bat", "boss"]))
  const reads = await page.evaluate(() => {
    const game = window.__lastKeep
    return (game.monsters || [])
      .filter((monster) => monster.kind === "bat" || monster.kind === "boss")
      .map((monster) => {
        const x = monster.drawX == null ? monster.x : monster.drawX
        const z = monster.drawZ == null ? monster.y : monster.drawZ
        const height = monster.kind === "bat" ? 36 : 48
        return { kind: monster.kind, onScreen: monster.onScreen, ...game.brightNear(x, z, height) }
      })
  })
  expect(reads.map((read) => read.kind).sort()).toEqual(["bat", "boss"])
  for (const read of reads) {
    expect(read.onScreen).toBe(true)
    expect(read.above).toBeGreaterThanOrEqual(24)
    expect(read.max).toBeGreaterThanOrEqual(read.field + 18)
  }
  await page.screenshot({ path: shot("parade.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function twoPlayerNight(browser) {
  const errors = []
  const host = await createHost(browser, "Bob", "warrior")
  const page = host.page
  watch(page, "host", errors)
  const code = await page.evaluate(() => document.body.dataset.code)
  const guest = await joinQuery(browser, code, "LLL", "mage")
  const friend = guest.page
  watch(friend, "guest", errors)

  await page.waitForFunction(() => document.querySelector("[data-roster]")?.innerText?.includes("LLL"))
  await expect(page.locator("[data-roster]")).toContainText("Warrior")
  await expect(friend.locator("[data-roster]")).toContainText("Mage")
  await expect(page.locator("[data-clock]")).toHaveText("Waiting to start")
  expect(await page.evaluate(() => window.__lastKeep.light)).toBe("day")
  await page.waitForFunction(() => window.__lastKeep.light === "day")
  await page.waitForFunction(() => {
    const mood = window.__lastKeep.frameMood()
    const ground = window.__lastKeep.frameGround()
    return mood.problems.length === 0 && ground.problems.length === 0
  })
  const dayMood = await page.evaluate(() => window.__lastKeep.frameMood())
  const dayGround = await page.evaluate(() => window.__lastKeep.frameGround())
  expect(dayMood.problems).toEqual([])
  expect(dayMood.lime).toBeLessThanOrEqual(0.08)
  expect(dayMood.contrast).toBeGreaterThanOrEqual(9)
  expect(dayGround.problems).toEqual([])
  expect(dayGround.spread).toBeGreaterThanOrEqual(8)
  const town = await page.evaluate(() => window.__lastKeep.townLook)
  expect(town.rank).toBe(0)
  expect(town.path).toBe(true)
  expect(town.keep).toContain("roof")
  expect(town.keep).toContain("brazier")
  expect(town.keep).not.toContain("battlement")
  expect(town.keep).toContain("course")
  expect(town.keepColors).toEqual(expect.arrayContaining([0x4b3c33, 0x654e41, 0x2c2a2a]))
  expect(town.bestiary).toEqual(["goblin", "skeleton", "wolf", "troll", "bat", "boss"])
  const forest = await page.evaluate(() => window.__lastKeep.forestLook)
  expect(forest.trunks).toBe(70)
  expect(forest.wood).toBe(0)
  expect(forest.crowns).toBe(false)
  expect(forest.stumps).toBe(true)
  expect(forest.wall).toBeGreaterThanOrEqual(80)
  expect(forest.treeBoughs).toBeGreaterThanOrEqual(3)
  await expect(page.locator("[data-wave]")).toHaveText("Wave 1")
  await expect(page.locator('[data-skill-name="attack"]')).toHaveText("Strike")
  await expect(friend.locator('[data-skill-name="q"]')).toHaveText("Fireball")
  await expect(page.locator("[data-touch-pad]")).toBeHidden()
  await expect(page.locator("#turn")).toBeHidden()
  await expect(page.locator('[data-build="wall"]')).toContainText("8 wood")
  await expect(page.locator("[data-score]")).toHaveText("Score 0")
  await assertBonuses(page)
  await assertDiegeticHud(page)
  await assertWaveClear(page)
  await page.screenshot({ path: shot("coop-host.png") })
  await friend.screenshot({ path: shot("coop-guest.png") })

  await focusClickDoesNotAttack(page)
  await clickDoesNotSpendWithoutABuilding(page)
  await invalidPlacementExplains(page)
  await movementIsInterpolated(page)
  // The blend check can hold W for the whole window. The hero is then far
  // northwest, and the southeast pine is a few pixels of sky. Walk back
  // before the dusk grade so the keep pine fills the sample.
  await returnNearTheKeep(page)
  await placeWall(page)
  await buildRangeRing(page)

  await expect(page.locator("[data-start]")).toHaveText("Start the night")
  await expect(friend.locator("[data-start]")).toHaveText("Waiting for the host")
  const notes = blankNotes()
  // Close on the warrior before the goblins do. An idle mage on the far
  // side of the ring is dead by the time both of them reach this camera,
  // and the fireball key then hits a corpse.
  await walkTowardHost(friend)
  await page.bringToFront()
  await page.locator("[data-start]").click()
  // Dusk is the last eight seconds. A full-frame read on every animation
  // frame spends that window inside readPixels. The light name is on the
  // snapshot. The grade then samples a few times, not every paint.
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.light === "dusk", undefined, {
    timeout: 20_000,
    polling: 100
  })
  // One framebuffer read per poll. Mood and ground used to read it twice,
  // and the second read finished after dusk on a slow runner.
  const duskHandle = await page.waitForFunction(() => {
    const game = window.__lastKeep
    if (!game || game.light !== "dusk" || !game.frameGrade) return false
    const grade = game.frameGrade()
    if (grade.mood.problems.length || grade.ground.problems.length) return false
    const stone = game.sampleWorld(0, 36, 6)
    const pine = game.sampleWorld(-22, 30, -62)
    if (!stone || !pine) return false
    const span = Math.abs(stone.hue - pine.hue) % 360
    if (Math.min(span, 360 - span) < 25) return false
    const hero = game.self
    return {
      mood: grade.mood,
      ground: grade.ground,
      stone,
      pine,
      // The card is 32 world units. Height 40 is above it and reads dusk
      // saturation 0.60. The steel on the card is height 18.
      plate: game.sampleWorld(hero.x, 18, hero.y)
    }
  }, undefined, { timeout: 8_000, polling: 400 })
  const duskMood = await duskHandle.jsonValue()
  expect(duskMood.mood.problems).toEqual([])
  expect(duskMood.mood.cool).toBeLessThanOrEqual(0.25)
  expect(duskMood.mood.warm).toBeGreaterThanOrEqual(0.03)
  expect(duskMood.ground.problems).toEqual([])
  expect(duskMood.ground.spread).toBeGreaterThanOrEqual(8)
  expect(duskMood.stone && duskMood.plate && duskMood.pine).toBeTruthy()
  const plateSat =
    (Math.max(duskMood.plate.r, duskMood.plate.g, duskMood.plate.b) -
      Math.min(duskMood.plate.r, duskMood.plate.g, duskMood.plate.b)) /
    Math.max(duskMood.plate.r, 1)
  expect(plateSat).toBeLessThan(0.2)
  const hueDistance = (left, right) => {
    const span = Math.abs(left - right) % 360
    return Math.min(span, 360 - span)
  }
  expect(hueDistance(duskMood.stone.hue, duskMood.pine.hue)).toBeGreaterThanOrEqual(25)
  await page.screenshot({ path: shot("dusk-host.png") })
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.light === "night", undefined, {
    timeout: 20_000,
    polling: 100
  })
  const nightHandle = await page.waitForFunction(() => {
    const game = window.__lastKeep
    if (!game || game.light !== "night" || !game.frameGrade) return false
    const grade = game.frameGrade()
    if (grade.mood.problems.length || grade.ground.problems.length) return false
    return grade.ground
  }, undefined, { timeout: 8_000, polling: 400 })
  const nightGround = await nightHandle.jsonValue()
  expect(nightGround.spread).toBeGreaterThanOrEqual(8)
  await assertNightAudio(page)
  await hintsClearTheRoster(page)
  // A stock goblin has 22 hp and the fireball deals 30. Casting first removes
  // one, and the wait for two on-screen monsters then sits until the test times out.
  await expectGoblinsOnYard(page)
  await assertMonsterSpread(page)
  await sample(page, notes)
  await expectGoblinsOnYard(friend)
  await castFireball(friend, notes)
  const sameKeep = await Promise.all([
    page.evaluate(() => window.__lastKeep.keep.hp),
    friend.evaluate(() => window.__lastKeep.keep.hp)
  ])
  expect(Math.abs(sameKeep[0] - sameKeep[1])).toBeLessThan(40)
  await page.screenshot({ path: shot("wave-host.png") })
  await friend.screenshot({ path: shot("wave-guest.png") })

  await stopWalk(friend)
  await fight(page, friend, notes)
  await page.waitForFunction(() => window.__lastKeep.kills >= 1, { timeout: 30_000 })
  await page.waitForFunction(
    () =>
      window.__lastKeep.phase === "build" &&
      window.__lastKeep.keep.hp > 0 &&
      window.__lastKeep.kills >= 1 &&
      window.__lastKeep.shownWave === 2,
    { timeout: 45_000 }
  )
  await sample(page, notes)
  await sample(friend, notes)
  assertCombat(notes)
  assertWaveStable(notes)
  await expect(page.locator("[data-wave]")).toHaveText("Wave 2")
  const score = await page.evaluate(() => window.__lastKeep.score)
  expect(score).toBeGreaterThanOrEqual(1000)
  await expect(page.locator("[data-score]")).toHaveText(`Score ${score}`)
  await page.screenshot({ path: shot("cleared-host.png") })
  await assertClearedAudio(page)
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
  await guest.context.close()
}

async function movementIsInterpolated(page) {
  await page.bringToFront()
  await page.evaluate(() => {
    const active = document.activeElement
    if (active && active.blur) active.blur()
  })
  const origin = await page.evaluate(() => ({ x: window.__lastKeep.self.x, y: window.__lastKeep.self.y }))
  await holdKey(page, "KeyW", true)
  // The blend is 45ms on the motion track the socket publishes. Counting
  // animation frames inside 900ms fails when a loaded runner paints four
  // times in that window, before the track has been read. The first open
  // sample can arrive before the hero has walked 20, so the loop stays
  // until both are true.
  const rows = []
  const started = Date.now()
  const travelOf = (row) => Math.hypot(row.sx - origin.x, row.sz - origin.y)
  try {
    while (Date.now() - started < 4_000) {
      const row = await page.evaluate(() => {
        const game = window.__lastKeep
        const track = game && game.motion
        if (!track || !game.self) return null
        const step = Math.hypot(track.toX - track.fromX, track.toZ - track.fromZ)
        const age = performance.now() - track.at
        return { step, age, sx: game.self.x, sz: game.self.y, open: step > 0.4 && step < 14 && age >= 0 && age < 45 }
      })
      if (row) rows.push(row)
      const open = rows.some((sample) => sample.open)
      if (rows.length > 5 && open && row && travelOf(row) > 20) break
      await page.waitForTimeout(20)
    }
  } finally {
    await holdKey(page, "KeyW", false)
  }
  expect(rows.length).toBeGreaterThan(5)
  const last = rows[rows.length - 1]
  const travel = Math.hypot(last.sx - origin.x, last.sz - origin.y)
  expect(travel).toBeGreaterThan(20)
  expect(rows.some((row) => row.open)).toBe(true)
  const wave = await page.locator(".chip").boundingBox()
  const view = page.viewportSize()
  expect(wave.x).toBeGreaterThanOrEqual(0)
  expect(wave.y).toBeGreaterThanOrEqual(0)
  expect(wave.x + wave.width).toBeLessThanOrEqual(view.width + 1)
  expect(wave.y + wave.height).toBeLessThanOrEqual(view.height + 1)
  await assertWaveClear(page)
}

async function squarePixels(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  watch(host.page, "host", errors)
  const ratios = []
  for (const size of [
    { width: 1600, height: 600 },
    { width: 600, height: 1000 },
    { width: 1280, height: 800 }
  ]) {
    await host.page.setViewportSize(size)
    await host.page.waitForFunction(
      (expected) => {
        const frame = window.__lastKeep && window.__lastKeep.frame
        if (!frame) return false
        const bufferAspect = frame.bufferWidth / frame.bufferHeight
        return Math.abs(bufferAspect - expected) < 0.08 && Math.abs(frame.aspect - expected) < 0.08 && frame.halfW >= 180
      },
      size.width / size.height
    )
    ratios.push(
      await host.page.evaluate(() => {
        const game = window.__lastKeep
        const origin = game.toClient(0, 0)
        const east = game.toClient(40, 0)
        const north = game.toClient(0, 40)
        const dx = Math.hypot(east.x - origin.x, east.y - origin.y)
        const dy = Math.hypot(north.x - origin.x, north.y - origin.y)
        return dx / dy
      })
    )
    await host.page.screenshot({ path: shot(`frame-${size.width}x${size.height}.png`) })
  }
  expect(Math.abs(ratios[0] - ratios[1])).toBeLessThan(0.12)
  expect(Math.abs(ratios[1] - ratios[2])).toBeLessThan(0.12)
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function joinFromForm(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  watch(host.page, "host", errors)
  const code = await host.page.evaluate(() => document.body.dataset.code)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const friend = await context.newPage()
  watch(friend, "guest", errors)
  await friend.goto(`/r/${code}`)
  await expect(friend.locator("#join-game")).toBeVisible()
  await friend.locator("#player-name").fill("Bo")
  await friend.locator('input[value="engineer"]').check()
  await friend.locator('#join-game button[type="submit"]').click()
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return roster.includes("Bo") && roster.includes("Ada") && document.querySelector("#join-game").hidden
  })
  await friend.screenshot({ path: shot("form-join.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
  await host.context.close()
}

async function walkTowardHost(page) {
  await page.evaluate(() => {
    window.__lastKeepWalk = window.setInterval(() => window.__lastKeepTest.follow(), 50)
  })
}

async function stopWalk(page) {
  await page.evaluate(() => {
    window.clearInterval(window.__lastKeepWalk)
    window.__lastKeepWalk = 0
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(code, false)
  })
}

async function buildRangeRing(page) {
  await pressKey(page, "Digit1")
  await page.waitForFunction(() => window.__lastKeep.rangeRing && window.__lastKeep.rangeRing.on)
  const ring = await page.evaluate(() => ({
    radius: window.__lastKeep.rangeRing.radius,
    reach: window.__lastKeep.self.range
  }))
  expect(ring.radius).toBe(ring.reach)
  expect(ring.radius).toBeGreaterThan(100)
  await pressKey(page, "Escape")
  await page.waitForFunction(() => window.__lastKeep.rangeRing && window.__lastKeep.rangeRing.on === false)
}

async function assertNightAudio(page) {
  await page.waitForFunction(() => (window.__lastKeep.audio?.cues || []).includes("horn"))
  const audio = await page.evaluate(() => window.__lastKeep.audio)
  expect(audio.cues).toContain("night")
  expect(audio.unlocked).toBe(true)
  expect(audio.loop).toBe("night")
}

async function assertWaveClear(page) {
  const hits = await page.evaluate(() => {
    const chip = document.querySelector(".chip")?.getBoundingClientRect()
    if (!chip || chip.width <= 0 || chip.height <= 0) return ["missing"]
    const view = { width: window.innerWidth, height: window.innerHeight }
    if (chip.left < 0 || chip.top < 0 || chip.right > view.width + 1 || chip.bottom > view.height + 1) return ["window"]
    return [...document.querySelectorAll(".sack, [data-bonuses], [data-roster], .heart, [data-you], .hint-arrow, .actions, .skills, .builds")]
      .filter((node) => !node.hidden && node.getBoundingClientRect().width > 0)
      .filter((node) => {
        const box = node.getBoundingClientRect()
        return box.left < chip.right && box.right > chip.left && box.top < chip.bottom && box.bottom > chip.top
      })
      .map((node) => node.getAttribute("data-sack") || node.getAttribute("data-bonuses") || node.className)
  })
  expect(hits).toEqual([])
}

async function hintsClearTheRoster(page) {
  await page.waitForFunction(() => document.querySelectorAll(".hint-arrow").length > 0)
  const overlap = await page.evaluate(() => {
    const roster = document.querySelector("[data-roster]").getBoundingClientRect()
    return [...document.querySelectorAll(".hint-arrow")].some((node) => {
      const box = node.getBoundingClientRect()
      return box.left < roster.right && box.right > roster.left && box.top < roster.bottom && box.bottom > roster.top
    })
  })
  expect(overlap).toBe(false)
}

async function assertMonsterSpread(page) {
  const gap = await page.evaluate(() => {
    const rows = window.__lastKeep.monsters || []
    let best = 0
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        best = Math.max(best, Math.hypot(rows[i].spreadX - rows[j].spreadX, rows[i].spreadZ - rows[j].spreadZ))
      }
    }
    return best
  })
  expect(gap).toBeGreaterThanOrEqual(16)
}

async function assertClearedAudio(page) {
  const cues = await page.evaluate(() => window.__lastKeep.audio.cues)
  expect(cues).toEqual(expect.arrayContaining(["horn", "sting", "hit", "kill", "build", "day"]))
  const fallen = await page.evaluate(() =>
    window.__lastKeepTest.hear({ tick: 500000, phase: "over", keep: { hp: 0, max: 900 }, events: [] })
  )
  expect(fallen).toContain("fall")
  await page.evaluate(() => {
    window.__lastKeepTest.volume(0.35)
    window.__lastKeepTest.mute(true)
  })
  await page.reload()
  await page.waitForFunction(
    () => window.__lastKeep?.audio?.muted === true && Math.abs(window.__lastKeep.audio.volume - 0.35) < 0.001
  )
  await expect(page.locator("[data-mute]")).toHaveText("Muted")
  await page.evaluate(() => window.__lastKeepTest.mute(false))
}

async function heroSilhouettes(browser) {
  const errors = []
  const party = [
    ["Ada", "warrior"],
    ["Lux", "mage"],
    ["Bram", "engineer"],
    ["Pip", "scout"],
    ["Nia", "farmer"]
  ]
  const host = await createHost(browser, party[0][0], party[0][1])
  watch(host.page, "host", errors)
  const code = await host.page.evaluate(() => document.body.dataset.code)
  const seats = [host]
  for (const [name, hero] of party.slice(1)) {
    const seat = await joinQuery(browser, code, name, hero)
    watch(seat.page, name, errors)
    seats.push(seat)
  }
  await host.page.waitForFunction(() => (window.__lastKeep.figures || []).length >= 5)
  const figures = await host.page.evaluate(() => window.__lastKeep.figures)
  expect(figures.map((figure) => figure.hero).sort()).toEqual(["engineer", "farmer", "mage", "scout", "warrior"])
  const keys = figures.map(
    (figure) => `${figure.marks.join("+")}|${figure.bounds.w}x${figure.bounds.h}x${figure.bounds.d}|${figure.parts}`
  )
  expect(new Set(keys).size).toBe(5)
  for (const figure of figures) {
    expect(figure.parts).toBeGreaterThanOrEqual(5)
    expect(figure.marks.length).toBeGreaterThan(0)
    expect(figure.bounds.h).toBeLessThanOrEqual(36)
    expect(figure.bounds.h).toBeGreaterThanOrEqual(28)
    expect(figure.px).toBeGreaterThanOrEqual(20)
    expect(figure.px).toBeLessThan(96)
  }
  await host.page.screenshot({ path: shot("heroes-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
  for (const seat of seats) await seat.context.close()
}

async function pressStick(page) {
  await page.evaluate(() => {
    const node = document.querySelector("#stage canvas")
    const fire = (type, x, y) => {
      node.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1
      }))
    }
    fire("pointerdown", 110, 220)
    fire("pointermove", 110, 80)
    window.__lastKeepStick = fire
  })
}

async function assertPhoneHud(page) {
  const report = await page.evaluate(() => {
    const shown = (node) => {
      if (!node || node.hidden) return false
      const style = getComputedStyle(node)
      if (style.display === "none" || style.visibility === "hidden") return false
      const box = node.getBoundingClientRect()
      return box.width >= 1 && box.height >= 1 ? box : null
    }
    const hints = []
    for (const node of document.querySelectorAll("#hud .build, #hud .skill, #hud .thumb")) {
      const box = shown(node)
      if (!box) continue
      const text = (node.innerText || "").trim()
      if (/\bLMB\b/.test(text) || /^[1-6]\s/.test(text) || /^(Q|E|R|Hit)$/.test(text)) hints.push(text)
    }
    const targets = [...document.querySelectorAll("[data-touch], [data-touch-context], [data-build]")]
      .map((node) => {
        const box = shown(node)
        if (!box) return null
        const key = node.dataset.touch || node.dataset.build || "context"
        return { key, w: box.width, h: box.height }
      })
      .filter(Boolean)
    const sacks = [...document.querySelectorAll(".sack")]
      .map((node) => {
        const box = shown(node)
        if (!box) return null
        return { key: node.dataset.sack, left: box.left, top: box.top, right: box.right, bottom: box.bottom }
      })
      .filter(Boolean)
    const overlaps = []
    for (let i = 0; i < sacks.length; i += 1) {
      for (let j = i + 1; j < sacks.length; j += 1) {
        const a = sacks[i]
        const b = sacks[j]
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push(`${a.key}-${b.key}`)
      }
    }
    return { hints, targets, overlaps, sacks: sacks.length }
  })
  expect(report.hints).toEqual([])
  expect(report.sacks).toBe(3)
  expect(report.overlaps).toEqual([])
  expect(report.targets.map((target) => target.key)).toEqual(
    expect.arrayContaining(["q", "attack", "e", "r", "context", "wall", "tower", "trap", "field", "forge", "mage_tower"])
  )
  const small = report.targets.filter((target) => target.w < 44 || target.h < 44)
  expect(small).toEqual([])
}

async function releaseStick(page) {
  await page.evaluate(() => {
    window.__lastKeepStick?.("pointerup", 110, 80)
  })
}

async function mobileTouch(browser) {
  const errors = []
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  const page = await context.newPage()
  watch(page, "phone", errors)
  await page.goto(gameUrl("/"))
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll(".hero-card img.portrait")]
    return imgs.length === 5 && imgs.every((img) => img.complete && img.naturalHeight >= 64 && img.naturalHeight <= 128)
  })
  await page.locator("#player-name").fill("Nia")
  await page.locator('input[value="warrior"]').check()
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction(() => document.querySelector("[data-roster]")?.innerText?.includes("Nia"))
  await expect(page.locator("[data-touch-pad]")).toBeVisible()
  await expect(page.locator("#turn")).toBeHidden()
  await expect(page.locator('[data-touch="attack"] img')).toBeVisible()
  const start = await page.evaluate(() => ({ x: window.__lastKeep.self.x, y: window.__lastKeep.self.y }))
  await pressStick(page)
  await page.waitForFunction((from) => {
    const me = window.__lastKeep.self
    return Math.hypot(me.x - from.x, me.y - from.y) > 20
  }, start)
  await releaseStick(page)
  await page.locator('[data-touch="q"]').tap()
  await page.waitForFunction(() => (window.__lastKeep.cds?.q || 0) > 0)
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  await page.locator('[data-build="wall"]').tap()
  await expect(page.locator("[data-touch-context]")).toBeVisible()
  await expect(page.locator("[data-touch-context]")).toHaveText("Wall")
  await assertPhoneHud(page)
  await page.locator("[data-touch-context]").tap()
  await page.waitForFunction((before) => window.__lastKeep.buildings > 0 && window.__lastKeep.wood < before, wood)
  await pressStick(page)
  await page.screenshot({ path: shot("mobile-landscape.png") })
  await releaseStick(page)
  await assertFarCaptions(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator("#turn")).toContainText("Rotate your device")
  await expect(page.locator("[data-turn-icon]")).toBeVisible()
  const cover = await page.evaluate(() => {
    const turn = document.querySelector("#turn")
    const box = turn.getBoundingClientRect()
    const style = getComputedStyle(turn)
    const match = String(style.backgroundColor).match(/rgba?\(([^)]+)\)/)
    const parts = match ? match[1].split(",").map((part) => Number(part.trim())) : []
    const alpha = parts.length < 4 ? 1 : parts[3]
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: window.innerWidth, height: window.innerHeight, alpha }
  })
  expect(cover.left).toBeLessThanOrEqual(0)
  expect(cover.top).toBeLessThanOrEqual(0)
  expect(cover.right).toBeGreaterThanOrEqual(cover.width)
  expect(cover.bottom).toBeGreaterThanOrEqual(cover.height)
  expect(cover.alpha).toBeGreaterThanOrEqual(0.75)
  await page.screenshot({ path: shot("mobile-portrait.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
}

async function townGrows(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "farmer")
  const page = host.page
  watch(page, "host", errors)
  const code = await page.evaluate(() => document.body.dataset.code)
  const guest = await joinQuery(browser, code, "Bob", "warrior")
  const friend = guest.page
  watch(friend, "guest", errors)

  const waiting = () => {
    const game = window.__lastKeep
    return game && game.town === 0 && game.buildings === 0 && game.wood === 48 && game.phase === "build"
  }
  await page.waitForFunction(waiting)
  await friend.waitForFunction(waiting)

  const aims = [
    [144, 0],
    [180, 0],
    [144, -36],
    [180, -36]
  ]
  for (const [x, y] of aims) {
    const before = await page.evaluate(
      () => (window.__lastKeep.structures || []).filter((row) => row.kind === "field").length
    )
    const spot = await page.evaluate((point) => window.__lastKeep.toClient(point.x, point.y), { x, y })
    await page.mouse.move(spot.x, spot.y)
    await pressKey(page, "KeyQ")
    await page.waitForFunction(
      (count) => (window.__lastKeep.structures || []).filter((row) => row.kind === "field").length > count,
      before
    )
    await page.waitForFunction(() => (window.__lastKeep.cds?.q || 0) === 0)
  }

  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(48)
  const open = await page.evaluate(() => {
    const rows = window.__lastKeep.structures || []
    return rows.some((row) => (row.x === 108 && row.y === 36) || (row.x === -108 && row.y === 36))
  })
  expect(open).toBe(false)

  await page.waitForFunction(
    () => {
      const text = document.querySelector("[data-sack='gold']")?.textContent || ""
      const match = text.match(/(\d+)/)
      return match && Number(match[1]) >= 8
    },
    undefined,
    { timeout: 25_000 }
  )
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(48)

  // Raise no longer needs the keep ring. Walking into that ring on a slow
  // runner stops inside the stone, and the southwest step then cannot move.
  await page.locator("[data-raise]").click()

  const grown = () => {
    const game = window.__lastKeep
    if (!game || game.town !== 1 || game.phase !== "build" || game.wood !== 22 || game.dirt !== 190) return false
    if (Math.abs(game.ring - 190 / 150) > 0.001) return false
    const houses = (game.structures || []).filter((row) => row.kind === "house")
    if (houses.length !== 4) return false
    const placed = houses.every((row) => {
      const dist = Math.hypot(row.x, row.y)
      return dist > 140 && dist < 190
    })
    if (!placed) return false
    const fields = (game.structures || []).filter((row) => row.kind === "field")
    const has = (x, y) => fields.some((row) => row.x === x && row.y === y)
    return has(108, 36) && has(-108, 36)
  }
  await page.waitForFunction(grown)
  await friend.waitForFunction(grown)
  const houseRead = await page.evaluate(() => {
    const house = (window.__lastKeep.structures || []).find((row) => row.kind === "house")
    return window.__lastKeep.brightNear(house.x, house.y, 12)
  })
  expect(houseRead.above).toBeGreaterThanOrEqual(619)

  await expect(page.locator("[data-chrome]")).toHaveCount(10)
  await expect(page.locator("[data-build]")).toHaveCount(6)
  await page.screenshot({ path: shot("town-growth-host.png") })
  await assertFarCaptions(page)
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
  await guest.context.close()
}

async function returnNearTheKeep(page) {
  const far = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return me ? Math.hypot(me.x, me.y) : 0
  })
  if (far < 140) return
  await page.bringToFront()
  await page.evaluate(() => window.__lastKeepTest.hold("KeyS", true))
  try {
    await page.waitForFunction(
      () => {
        const me = window.__lastKeep.self
        return me && Math.hypot(me.x, me.y) < 140
      },
      undefined,
      { timeout: 15_000, polling: 100 }
    )
  } finally {
    await page.evaluate(() => window.__lastKeepTest.hold("KeyS", false))
  }
}

async function holdCodes(page, codes) {
  await page.evaluate((wanted) => {
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
      window.__lastKeepTest.hold(code, wanted.includes(code))
    }
  }, codes)
}

async function releaseCodes(page) {
  await holdCodes(page, [])
}

async function assertFarCaptions(page) {
  await page.bringToFront()
  // The position is published on the socket. A covered page does not have to
  // paint a frame. North of the keep, then west. On the west face KeyW slides
  // along x and y never passes -220, so a stalled north walk steps outward
  // until the west line is clear of the keep.
  const published = { timeout: 20_000, polling: 100 }
  const startY = await page.evaluate(() => (window.__lastKeep.self ? window.__lastKeep.self.y : 0))
  await holdCodes(page, ["KeyW"])
  let north = false
  try {
    north = await page
      .waitForFunction(
        (from) => window.__lastKeep.self && window.__lastKeep.self.y < from - 40,
        startY,
        { timeout: 3_000, polling: 100 }
      )
      .then(() => true)
      .catch(() => false)
    if (north) {
      await page.waitForFunction(() => window.__lastKeep.self && window.__lastKeep.self.y < -220, undefined, published)
    }
  } finally {
    await releaseCodes(page)
  }
  if (!north) {
    const headings = [
      ["KeyA", "KeyW"],
      ["KeyW"],
      ["KeyW", "KeyD"],
      ["KeyD"],
      ["KeyD", "KeyS"],
      ["KeyS"],
      ["KeyS", "KeyA"],
      ["KeyA"]
    ]
    const deadline = Date.now() + 12_000
    let spin = 0
    let best = 0
    let since = Date.now()
    try {
      while (Date.now() < deadline) {
        const me = await page.evaluate(() => {
          const self = window.__lastKeep.self
          return self ? { x: self.x, y: self.y } : null
        })
        if (!me) break
        const dist = Math.hypot(me.x, me.y)
        if (dist > 80 && (me.x < -80 || Math.abs(me.y) > 90)) break
        if (dist > best + 4) {
          best = dist
          since = Date.now()
        } else if (Date.now() - since > 700) {
          spin = (spin + 1) % headings.length
          since = Date.now()
        }
        await holdCodes(page, headings[spin])
        await page.waitForTimeout(100)
      }
    } finally {
      await releaseCodes(page)
    }
  }
  await page.evaluate(() => {
    window.__lastKeepTest.hold("KeyA", true)
    window.__lastKeepTest.hold("KeyW", true)
  })
  try {
    await page.waitForFunction(() => window.__lastKeep.self && window.__lastKeep.self.x < -700, undefined, published)
  } finally {
    await page.evaluate(() => {
      window.__lastKeepTest.hold("KeyA", false)
      window.__lastKeepTest.hold("KeyW", false)
    })
  }
  await expect.poll(() => page.evaluate(captionHits), { timeout: 5_000 }).toEqual([])
  const far = await page.evaluate(() => window.__lastKeep.self)
  expect(far.x).toBeLessThan(-700)
}

function captionHits() {
  const shown = (selector) => {
    const node = document.querySelector(selector)
    if (!node || node.hidden) return null
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden") return null
    const box = node.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return null
    return box
  }
  const overlap = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  const roster = shown("[data-roster]")
  const relic = shown("[data-bonuses]")
  const builds = shown(".builds")
  const skills = shown(".skills")
  const pad = shown("[data-touch-pad]")
  const bad = []
  if (!roster || !relic || !builds) bad.push("missing")
  if (overlap(roster, builds)) bad.push("roster-builds")
  if (overlap(relic, builds)) bad.push("relic-builds")
  if (overlap(roster, relic)) bad.push("roster-relic")
  if (overlap(roster, skills)) bad.push("roster-skills")
  if (overlap(relic, skills)) bad.push("relic-skills")
  if (overlap(roster, pad)) bad.push("roster-pad")
  if (overlap(relic, pad)) bad.push("relic-pad")
  const me = window.__lastKeep.self
  if (!me || me.x > -700) bad.push("near")
  return bad
}

async function captionsClearTheBuilds(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  const page = host.page
  watch(page, "host", errors)
  await assertFarCaptions(page)
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

const PHONE_SIZES = [
  [844, 390],
  [667, 375],
  [932, 430]
]

function phoneOverlaps() {
  const shown = (node) => {
    if (!node || node.hidden) return null
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden") return null
    const box = node.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return null
    return box
  }
  const tag = (node) => {
    if (node.dataset.sack) return node.dataset.sack
    if (node.dataset.touch) return node.dataset.touch
    if (node.hasAttribute("data-touch-context")) return "context"
    if (node.dataset.build) return node.dataset.build
    if (node.hasAttribute("data-raise")) return "raise"
    if (node.hasAttribute("data-copy")) return "copy"
    if (node.hasAttribute("data-mute")) return "mute"
    if (node.hasAttribute("data-volume")) return "volume"
    if (node.hasAttribute("data-start")) return "start"
    if (node.hasAttribute("data-bonuses")) return "relics"
    if (node.hasAttribute("data-roster")) return "roster"
    if (node.classList.contains("heart")) return "heart"
    if (node.hasAttribute("data-you")) return "you"
    if (node.classList.contains("hint-arrow")) return (node.textContent || "call").trim()
    if (node.classList.contains("chip")) return "wave"
    if (node.classList.contains("stick")) return "stick"
    return "hud"
  }
  const nodes = [
    ...document.querySelectorAll(
      ".sack, [data-bonuses], [data-roster], .heart, [data-you], .hint-arrow, .chip, [data-touch], [data-touch-context], [data-build], .stick, [data-raise], [data-copy], [data-mute], [data-volume], [data-start]"
    )
  ]
  const boxes = nodes.map((node) => ({ node, tag: tag(node), box: shown(node) })).filter((row) => row.box)
  const hits = []
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.node.contains(b.node) || b.node.contains(a.node)) continue
      const width = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
      const height = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
      if (width >= 1 && height >= 1) hits.push(`${a.tag}/${b.tag}`)
    }
  }
  return hits
}

async function assertPhoneClear(page) {
  for (const [width, height] of PHONE_SIZES) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect.poll(() => page.evaluate(phoneOverlaps), { timeout: 4_000 }).toEqual([])
  }
}

function keysToward(me, goal) {
  const dx = goal.x - me.x
  const dy = goal.y - me.y
  // The join ring and the keep sit north of y=-165. A drift into that band
  // stops the body on a guest, so the southern goal wins until the lane is back.
  if (me.y > -165 && goal.y < -160) return ["KeyW", "KeyD"]
  if (Math.abs(dx) > 28) return dx >= 0 ? ["KeyS", "KeyD"] : ["KeyA", "KeyW"]
  if (Math.abs(dy) > 18) return dy >= 0 ? ["KeyS", "KeyA"] : ["KeyW", "KeyD"]
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["KeyS", "KeyD"] : ["KeyA", "KeyW"]
  return dy >= 0 ? ["KeyS", "KeyA"] : ["KeyW", "KeyD"]
}

async function steer(page, goal, done, timeout, label) {
  const deadline = Date.now() + timeout
  let last = null
  try {
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => {
        const me = window.__lastKeep.self
        const call = [...document.querySelectorAll(".hint-arrow")].some((node) => /goblin/i.test(node.textContent || ""))
        return me ? { x: me.x, y: me.y, alive: me.alive !== false, call } : null
      })
      last = state
      if (state && done(state)) return state
      if (state) {
        const keys = keysToward(state, goal)
        await page.evaluate((down) => {
          for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, down.includes(key))
        }, keys)
      }
      await page.waitForTimeout(80)
    }
  } finally {
    await page.evaluate(() => {
      for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, false)
    })
  }
  throw new Error(`${label} timed out at ${JSON.stringify(last)}`)
}

async function phoneClear(browser) {
  const errors = []
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  const page = await context.newPage()
  watch(page, "phone", errors)
  await page.goto(gameUrl("/"))
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll(".hero-card img.portrait")]
    return imgs.length === 5 && imgs.every((img) => img.complete && img.naturalHeight >= 64 && img.naturalHeight <= 128)
  })
  await page.locator("#player-name").fill("Nia")
  await page.locator('input[value="farmer"]').check()
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction(() => document.querySelector("[data-roster]")?.innerText?.includes("Nia"))
  const code = await page.evaluate(() => document.body.dataset.code)
  const seats = []
  for (const [name, hero] of [
    ["Ada", "warrior"],
    ["Lux", "mage"],
    ["Bram", "engineer"],
    ["Pip", "scout"]
  ]) {
    const seat = await joinQuery(browser, code, name, hero)
    seats.push(seat)
    watch(seat.page, name, errors)
  }
  await page.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return ["Nia", "Ada", "Lux", "Bram", "Pip"].every((name) => roster.includes(name))
  })
  await assertPhoneClear(page)
  const aims = [
    [144, 0],
    [180, 0],
    [144, -36],
    [180, -36]
  ]
  for (const [x, y] of aims) {
    const before = await page.evaluate(() => (window.__lastKeep.structures || []).filter((row) => row.kind === "field").length)
    const spot = await page.evaluate((point) => window.__lastKeep.toClient(point.x, point.y), { x, y })
    await page.mouse.move(spot.x, spot.y)
    await pressKey(page, "KeyQ")
    await page.waitForFunction(
      (count) => (window.__lastKeep.structures || []).filter((row) => row.kind === "field").length > count,
      before
    )
    await page.waitForFunction(() => (window.__lastKeep.cds?.q || 0) === 0)
  }
  await page.waitForFunction(
    () => {
      const text = document.querySelector("[data-sack='gold']")?.textContent || ""
      const match = text.match(/(\d+)/)
      return match && Number(match[1]) >= 8
    },
    undefined,
    { timeout: 25_000 }
  )
  await page.locator("[data-raise]").click()
  await page.waitForFunction(() => window.__lastKeep.town === 1)
  await assertPhoneClear(page)
  // The guests stand on the join ring. Walking back from the west stops on
  // that ring, so the far pose happens after the fields and the raise.
  await assertFarCaptions(page)
  await assertPhoneClear(page)
  await page.locator("[data-start]").click()
  await page.waitForFunction(() => window.__lastKeep.phase === "wave")
  await page.bringToFront()
  await page.waitForFunction(
    () => (window.__lastKeep.monsters || []).some((row) => row.kind === "goblin"),
    undefined,
    { timeout: 10_000, polling: 100 }
  )
  const here = await page.evaluate(() => window.__lastKeep.self)
  await steer(page, { x: here.x, y: -210 }, (state) => state.alive && state.y < -180, 20_000, "south of the houses")
  const packX = await page.evaluate(() => {
    const goblins = (window.__lastKeep.monsters || []).filter((row) => row.kind === "goblin")
    return goblins.reduce((sum, row) => sum + row.x, 0) / goblins.length
  })
  // The pack picks a fresh bearing each night. Running west meets the ones
  // that spawned there, so the call never sits on screen at the far mark.
  const away = packX >= here.x ? here.x - 320 : here.x + 320
  await steer(
    page,
    { x: away, y: -210 },
    (state) => state.alive && state.call && state.y < -160 && Math.hypot(state.x, state.y) > 400,
    25_000,
    "goblin call away from the pack"
  )
  await assertPhoneClear(page)
  const call = await page.evaluate(() => [...document.querySelectorAll(".hint-arrow")].map((node) => node.textContent || "").join(" "))
  expect(call).toMatch(/goblin/i)
  expect(errors, errors.join("\n")).toEqual([])
  for (const seat of seats) await seat.context.close()
  await context.close()
}

async function scoreList(request) {
  const response = await request.get("/api/highscores")
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  for (const row of body.scores || []) {
    expect(row.score).toBeGreaterThan(0)
    expect((row.names || []).join("").trim().length).toBeGreaterThan(0)
  }
}

module.exports = {
  prepareProof,
  proofDir,
  gameUrl,
  createHost,
  joinQuery,
  twoPlayerNight,
  joinFromForm,
  squarePixels,
  scoreList,
  heroSilhouettes,
  paradeShowsEveryKind,
  mobileTouch,
  townGrows,
  captionsClearTheBuilds,
  phoneClear
}
