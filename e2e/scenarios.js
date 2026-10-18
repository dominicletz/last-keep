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
  const started = Date.now()
  let peak = 0
  while (Date.now() - started < 350) {
    peak = Math.max(peak, await page.evaluate(() => window.__lastKeep.attackCd || 0))
    await page.waitForTimeout(40)
  }
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
  await page.waitForTimeout(400)
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
  await page.waitForTimeout(2600)
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
  await friend.bringToFront()
  const click = await friend.evaluate(() => {
    const game = window.__lastKeep
    const monster = (game.monsters || [])[0]
    return monster ? game.toClient(monster.x, monster.y) : null
  })
  expect(click).toBeTruthy()
  const viewport = friend.viewportSize()
  const inside =
    click.x > 8 && click.y > 8 && click.x < viewport.width - 8 && click.y < viewport.height - 8
  if (inside) {
    await friend.mouse.click(click.x, click.y)
    await friend.mouse.click(click.x, click.y)
  }
  // Hold the key until the shot is visible. An 80ms tap can be encoded after
  // the key is already up, so the server never sees the edge.
  await holdKey(friend, "KeyQ", true)
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
    const debug = await friend.evaluate(() => ({
      cds: window.__lastKeep.cds,
      kinds: window.__lastKeep.kinds,
      projectiles: window.__lastKeep.projectiles,
      hero: window.__lastKeep.self && window.__lastKeep.self.hero,
      alive: window.__lastKeep.alive,
      hp: window.__lastKeep.hp,
      tick: window.__lastKeep.tick,
      monsters: (window.__lastKeep.monsters || []).length,
      phase: window.__lastKeep.phase
    }))
    throw new Error(`fireball was not on screen ${JSON.stringify(debug)} (${err.message})`)
  } finally {
    await holdKey(friend, "KeyQ", false)
  }
  await sample(friend, notes)
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
  await page.waitForFunction(() => window.__lastKeep.field && window.__lastKeep.field.variance < 30)
  const dayField = await page.evaluate(() => window.__lastKeep.field)
  expect(dayField.light).toBe("day")
  expect(dayField.luma).toBeGreaterThanOrEqual(100)
  expect(dayField.hue).toBeGreaterThanOrEqual(70)
  expect(dayField.hue).toBeLessThan(95)
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
  expect(forest.treeBoughs).toBeGreaterThanOrEqual(3)
  await expect(page.locator("[data-wave]")).toHaveText("Wave 1")
  await expect(page.locator('[data-skill-name="attack"]')).toHaveText("Strike")
  await expect(friend.locator('[data-skill-name="q"]')).toHaveText("Fireball")
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
  await placeWall(page)
  await buildRangeRing(page)

  await expect(page.locator("[data-start]")).toHaveText("Start the night")
  await expect(friend.locator("[data-start]")).toHaveText("Waiting for the host")
  const notes = blankNotes()
  // Close on the warrior before the goblins do. An idle mage on the far
  // side of the ring is dead by the time both of them reach this camera,
  // and the fireball key then hits a corpse.
  await walkTowardHost(friend)
  await page.locator("[data-start]").click()
  await page.waitForFunction((dayLuma) => {
    const field = window.__lastKeep.field
    return (
      field &&
      field.light === "dusk" &&
      field.variance < 30 &&
      field.luma >= 72 &&
      field.luma < dayLuma &&
      field.hue <= 48 &&
      field.hue >= 28
    )
  }, dayField.luma)
  await page.waitForFunction(() => window.__lastKeep.light === "night")
  await assertNightAudio(page)
  await hintsClearTheRoster(page)
  await expectGoblinsOnYard(page)
  await assertMonsterSpread(page)
  await sample(page, notes)
  await expectGoblinsOnYard(friend)
  const sameKeep = await Promise.all([
    page.evaluate(() => window.__lastKeep.keep.hp),
    friend.evaluate(() => window.__lastKeep.keep.hp)
  ])
  expect(Math.abs(sameKeep[0] - sameKeep[1])).toBeLessThan(40)
  await page.screenshot({ path: shot("wave-host.png") })
  await friend.screenshot({ path: shot("wave-guest.png") })

  await stopWalk(friend)
  await castFireball(friend, notes)
  await fight(page, friend, notes)
  await friend.waitForFunction(() => (window.__lastKeep.log || []).some((row) => row.type === "boom"), {
    timeout: 5_000
  })
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
  const rows = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = []
        const start = performance.now()
        function tick() {
          const game = window.__lastKeep
          if (game?.rendered && game.self) {
            samples.push({ x: game.rendered.x, z: game.rendered.z, sx: game.self.x, sz: game.self.y })
          }
          if (performance.now() - start < 900) requestAnimationFrame(tick)
          else resolve(samples)
        }
        requestAnimationFrame(tick)
      })
  )
  await holdKey(page, "KeyW", false)
  expect(rows.length).toBeGreaterThan(5)
  const last = rows[rows.length - 1]
  const travel = Math.hypot(last.sx - origin.x, last.sz - origin.y)
  let sawBlend = false
  let maxGap = 0
  for (const row of rows) {
    const gap = Math.hypot(row.x - row.sx, row.z - row.sz)
    maxGap = Math.max(maxGap, gap)
    if (gap > 0.4) sawBlend = true
  }
  expect(travel).toBeGreaterThan(20)
  expect(sawBlend).toBe(true)
  expect(maxGap).toBeLessThan(14)
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
    expect(figure.bounds.h).toBeGreaterThanOrEqual(30)
  }
  await host.page.screenshot({ path: shot("heroes-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
  for (const seat of seats) await seat.context.close()
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
  paradeShowsEveryKind
}
