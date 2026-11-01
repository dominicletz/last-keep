const { expect } = require("@playwright/test")
const { lowContext } = require("./low_tier")
const { joinTogether, rosterReady } = require("./roster")
const { cardSpan, projectBox } = require("./screen")
const { settledHolds } = require("./settled")
const { noteNorth, noteProgress, settleFields, stoppedTick } = require("./steer")
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

async function createHost(browser, name, hero, prepare) {
  const options = prepare && typeof prepare !== "function" ? prepare : {}
  const ready = typeof prepare === "function" ? prepare : null
  const context = await lowContext(browser, { viewport: { width: 1280, height: 800 }, ...options })
  const page = await context.newPage()
  if (ready) await ready(page)
  await page.goto(gameUrl("/"))
  await page.locator("#start-button").waitFor()
  await page.locator("#player-name").fill(name)
  await pickClass(page, hero)
  await page.locator("#start-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction((who) => document.querySelector("[data-roster]")?.innerText?.includes(who), name)
  return { context, page }
}

async function pickClass(page, hero) {
  for (let i = 0; i < 5; i += 1) {
    const current = await page.locator("#start-screen").getAttribute("data-hero")
    if (current === hero) return
    await page.locator("[data-class=next]").click()
  }
  throw new Error(`class ${hero}`)
}

async function joinQuery(browser, code, name, hero, onPage) {
  const context = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  if (onPage) onPage(page)
  await page.goto(gameUrl(`/r/${code}?name=${encodeURIComponent(name)}&hero=${hero}`))
  await waitForSeats(page, [name])
  return { context, page }
}

// The roster pin hides the node when the phone has no canvas box, and
// innerText is then empty. The snapshot already lists who the room accepted.
async function waitForSeats(page, names) {
  await page.waitForFunction(
    (expected) => {
      const seats = (window.__lastKeep && window.__lastKeep.seats) || null
      if (!Array.isArray(seats)) return false
      return expected.every((name) => seats.some((seat) => seat && seat.name === name && seat.connected === true))
    },
    names
  )
  const seats = await page.evaluate(() => window.__lastKeep.seats)
  if (!rosterReady(seats, names)) throw new Error("roster")
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

// The cooldown is 8 ticks. A backed-up channel delivers a later snapshot
// that has already cooled, and a 12-tick poll then reads 0. The page latches
// saw_swing, so this wait can outlast the pulse.
const SWING_WAIT_MS = 2_000

async function swungSinceReset(page) {
  try {
    await page.waitForFunction(() => (window.__lastKeep.attackPeak || 0) > 0, undefined, {
      timeout: SWING_WAIT_MS,
      polling: 100
    })
  } catch (error) {
    if (!/Timeout/.test(String(error && error.message))) throw error
  }
  return page.evaluate(() => window.__lastKeep.attackPeak || 0)
}

async function focusClickDoesNotAttack(page) {
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.toClient(me.x + 20, me.y)
  })
  const tag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, spot)
  expect(tag).toBe("CANVAS")
  await page.evaluate(() => {
    window.__lastKeep.attackPeak = 0
    window.__lastKeepTest.blur()
  })
  await page.mouse.click(spot.x, spot.y)
  const peak = await swungSinceReset(page)
  expect(peak).toBe(0)
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(wood)
  // The guest window can blur the host during those ticks. Bring it back
  // and mark the game focused, then the click has to swing.
  await page.bringToFront()
  // bringToFront can blur after this returns. Let that timeout land, then
  // mark the game focused and clear the peak, or the swing click is thrown away.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          window.__lastKeep.attackPeak = 0
          window.__lastKeepTest.focus()
          resolve()
        }, 0)
      })
  )
  await page.mouse.click(spot.x, spot.y)
  const swung = await swungSinceReset(page)
  expect(swung).toBeGreaterThan(0)
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
  // A seat that just woke compiles its first presents. Those reads come
  // back empty. Six later frames are a steady picture. The card is drawn at
  // the mesh, which can sit off the sim point. y=16 is the sparse crown of
  // an 18-unit goblin. y=8 is the torso. The count stays above 8.
  const mark = await page.evaluate(() => window.__lastKeep.renders || 0)
  await page.waitForFunction((n) => (window.__lastKeep.renders || 0) >= n + 6, mark)
  const ink = await page.evaluate(() => {
    const game = window.__lastKeep
    return (game.monsters || []).map((monster) => {
      const x = monster.drawX == null ? monster.x : monster.drawX
      const z = monster.drawZ == null ? monster.y : monster.drawZ
      const crown = game.redNear(x, z, 16)
      const torso = game.redNear(x, z, 8)
      return { kind: monster.kind, count: Math.max(crown, torso) }
    })
  })
  expect(ink.some((row) => row.count > 8), JSON.stringify(ink)).toBe(true)
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
  // The floater node leaves after 2.5s. drawFx writes the same word onto the
  // log when it appends the node, and that log outlives the poll gap.
  if (row.fx.includes("Slain")) notes.slain = true
  if (row.fx.includes("Boom")) notes.boom = true
  if (row.floaters.some((left) => !left || left.includes("NaN"))) notes.nan = true
  if (row.rising) notes.rising = true
  for (const ev of row.log) {
    if (ev.type === "hit" && ev.amount > 0) {
      notes.hit = true
      // drawFx writes that amount onto the floater. The node leaves after
      // 1.4s, so a slow poll can miss the digit that was already shown.
      notes.digit = true
    }
    if (ev.type === "death") notes.death = true
    if (ev.text === "Slain") notes.slain = true
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
    const tick = await page.evaluate(() => window.__lastKeep.tick)
    await page.waitForFunction((mark) => window.__lastKeep.tick > mark, tick)
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
  const tick = await page.evaluate(() => window.__lastKeep.tick)
  await holdKey(page, code, true)
  await page.waitForFunction((mark) => window.__lastKeep.tick > mark, tick)
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
  const dayHandle = await page.waitForFunction(
    () => {
      const game = window.__lastKeep
      if (!game || !game.yardGrade) return false
      const grade = game.yardGrade()
      return grade && grade.ok ? grade : false
    },
    undefined,
    { polling: 100 }
  )
  const day = await dayHandle.jsonValue()
  expect(day.mode).toBe("hd2d")
  expect(day.fov).toBe(15)
  expect(Number.isFinite(day.crisp)).toBe(true)
  expect(Number.isFinite(day.miniature)).toBe(true)
  expect(Number.isFinite(day.shadows)).toBe(true)
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
  // The guest stays in the room. Its present is the second SwiftShader page
  // that pushes this night past the test cap. The goblin read wakes it.
  await friend.evaluate(() => window.__lastKeepTest.quiet())

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
  // One framebuffer read per poll, owned by duskGrade. Mood and ground used
  // to read it twice, and the second read finished after dusk on a slow runner.
  const duskHandle = await page.waitForFunction(
    () => {
      const game = window.__lastKeep
      if (!game || !game.duskGrade) return false
      const grade = game.duskGrade()
      return grade && grade.ok ? grade : false
    },
    undefined,
    { timeout: 8_000, polling: 400 }
  )
  const duskMood = await duskHandle.jsonValue()
  expect(duskMood.mode).toBe("hd2d")
  expect(duskMood.fov).toBe(15)
  expect(Number.isFinite(duskMood.chroma)).toBe(true)
  await page.screenshot({ path: shot("dusk-host.png") })
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.light === "night", undefined, {
    timeout: 20_000,
    polling: 100
  })
  const nightHandle = await page.waitForFunction(
    () => {
      const game = window.__lastKeep
      if (!game || !game.nightGrade) return false
      return game.nightGrade() || false
    },
    undefined,
    { timeout: 8_000, polling: 400 }
  )
  const nightGround = await nightHandle.jsonValue()
  expect(nightGround.mode).toBe("hd2d")
  expect(Number.isFinite(nightGround.pools)).toBe(true)
  expect(Number.isFinite(nightGround.cap)).toBe(true)
  expect(Number.isFinite(nightGround.halo)).toBe(true)
  await assertNightAudio(page)
  await hintsClearTheRoster(page)
  // A stock goblin has 22 hp and the fireball deals 30. Casting first removes
  // one, and the wait for two on-screen monsters then sits until the test times out.
  await expectGoblinsOnYard(page)
  await assertMonsterSpread(page)
  await sample(page, notes)
  await friend.evaluate(() => window.__lastKeepTest.wake())
  await friend.bringToFront()
  await expectGoblinsOnYard(friend)
  await castFireball(friend, notes)
  const sameKeep = await Promise.all([
    page.evaluate(() => window.__lastKeep.keep.hp),
    friend.evaluate(() => window.__lastKeep.keep.hp)
  ])
  expect(Math.abs(sameKeep[0] - sameKeep[1])).toBeLessThan(40)
  await page.screenshot({ path: shot("wave-host.png") })
  await friend.screenshot({ path: shot("wave-guest.png") })
  await friend.evaluate(() => window.__lastKeepTest.quiet())

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
  // The blend is 45ms on the motion track the socket publishes. Counting
  // animation frames inside 900ms fails when a loaded runner paints four
  // times in that window, before the track has been read. The first open
  // sample can arrive before the hero has walked 20, so the loop stays
  // until both are true. The poll is 20ms so the open window is not missed.
  // Arrival is the server position, inside the same 4 seconds.
  const rows = []
  await walkUntil(page, {
    timeout: 4_000,
    label: "interpolated walk",
    poll: 20,
    soft: true,
    done: (row) => rows.length > 5 && rows.some((sample) => sample.open) && row.travel > 20,
    step: async (current) => {
      await holdCodes(current, ["KeyW"])
      const row = await current.evaluate((start) => {
        const game = window.__lastKeep
        return game && game.blend ? game.blend(start) : null
      }, origin)
      if (row) rows.push(row)
      return row
    }
  })
  expect(rows.length).toBeGreaterThan(5)
  const last = rows[rows.length - 1]
  expect(last.travel).toBeGreaterThan(20)
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
  const context = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const friend = await context.newPage()
  watch(friend, "guest", errors)
  await friend.goto(`/r/${code}`)
  await expect(friend.locator("#start-screen")).toBeVisible()
  await friend.locator("#player-name").fill("Bo")
  await pickClass(friend, "engineer")
  await friend.locator("#start-button").click()
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    const start = document.querySelector("#start-screen")
    return roster.includes("Bo") && roster.includes("Ada") && start && start.hidden
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
    await seat.page.evaluate(() => window.__lastKeepTest.quiet())
    seats.push(seat)
  }
  await host.page.waitForFunction(() => (window.__lastKeep.figures || []).length >= 5)
  const figures = await host.page.evaluate(() => window.__lastKeep.figures)
  expect(figures.map((figure) => figure.hero).sort()).toEqual(["engineer", "farmer", "mage", "scout", "warrior"])
  const keys = figures.map(
    (figure) => `${figure.marks.join("+")}|${figure.bounds.w}x${figure.bounds.h}x${figure.bounds.d}|${figure.parts}`
  )
  expect(new Set(keys).size).toBe(5)
  const view = await host.page.evaluate(() => ({
    height: window.__lastKeep.frame.bufferHeight,
    keep: window.__lastKeep.keepFigure
  }))
  // The drawing buffer is the window. cardSpan projects a card of world
  // height 28 and 36 through the HD-2D camera (fov 15, span from halfH 168,
  // cameraDistance 150, cameraLift 32). The span is the face-on and edge-on
  // yaw of that card. figure.px has to sit between those two heights. The
  // keep is the building in the same picture: its screen height is projectBox
  // of its mesh, within a pixel, and the hero-to-keep ratio has to match.
  const keepPred = projectBox(
    { min: view.keep.min, max: view.keep.max },
    view.height
  )
  expect(view.keep.worldH).toBeGreaterThan(0)
  expect(Math.abs(view.keep.px - keepPred)).toBeLessThanOrEqual(1)
  for (const figure of figures) {
    expect(figure.parts).toBeGreaterThanOrEqual(5)
    expect(figure.marks.length).toBeGreaterThan(0)
    expect(figure.bounds.h).toBeLessThanOrEqual(36)
    expect(figure.bounds.h).toBeGreaterThanOrEqual(28)
    const floor = cardSpan(figure.x, figure.z, 28, figure.bounds.w, view.height).min
    const cap = cardSpan(figure.x, figure.z, 36, figure.bounds.w, view.height).max
    expect(figure.px).toBeGreaterThanOrEqual(Math.floor(floor))
    expect(figure.px).toBeLessThanOrEqual(Math.ceil(cap))
    const body = cardSpan(figure.x, figure.z, figure.bounds.h, figure.bounds.w, view.height)
    expect(figure.px).toBeGreaterThanOrEqual(Math.floor(body.min))
    expect(figure.px).toBeLessThanOrEqual(Math.ceil(body.max))
    // figurePixels rounds to a pixel, so the ratio may move by one pixel
    // on the hero and one pixel on the keep.
    const ratio = figure.px / view.keep.px
    const slack = 1 / view.keep.px + 1 / keepPred
    expect(ratio).toBeGreaterThanOrEqual(body.min / keepPred - slack)
    expect(ratio).toBeLessThanOrEqual(body.max / keepPred + slack)
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
  const context = await lowContext(browser, {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  const page = await context.newPage()
  watch(page, "phone", errors)
  await page.goto(gameUrl("/"))
  await page.locator("#start-button").waitFor()
  await page.locator("#player-name").fill("Nia")
  await pickClass(page, "warrior")
  await page.locator("#start-button").click()
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

async function sowFour(page) {
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
    await page.bringToFront()
    // A covered phone drops the mouse, and Q then aims at the keep. The hook
    // sets the meadow point, and the next push is the sow.
    await page.evaluate((point) => window.__lastKeepTest.aim(point.x, point.y), { x, y })
    const aimed = await page.evaluate(() => window.__lastKeep.tick)
    await page.waitForFunction((mark) => window.__lastKeep.tick > mark, aimed)
    await pressKey(page, "KeyQ")
    await page.waitForFunction(
      (count) => (window.__lastKeep.structures || []).filter((row) => row.kind === "field").length > count,
      before,
      { polling: 100 }
    )
    await page.waitForFunction(() => (window.__lastKeep.cds?.q || 0) === 0, undefined, { polling: 100 })
  }
}

async function waitForRaiseGold(page) {
  await page.waitForFunction(
    () => {
      const text = document.querySelector("[data-sack='gold']")?.textContent || ""
      const match = text.match(/(\d+)/)
      return match && Number(match[1]) >= 8
    },
    undefined,
    { timeout: 25_000, polling: 100 }
  )
}

async function walkToRaise(page) {
  // keysAround will not step inward, so the tangent leaves the hero outside
  // the last 10 of the raise radius. The eight-way step walks in until the
  // keep face stops it, which is inside that radius. The server position is
  // the arrival. The wait stays 25 seconds.
  return walkUntil(page, {
    timeout: 25_000,
    label: "raise ring",
    poll: 80,
    done: (state) => state.raiseReady && Math.hypot(state.x, state.y) < 90,
    step: (current) =>
      current.evaluate(() => {
        const me = window.__lastKeep.self
        const button = document.querySelector("[data-raise]")
        if (!me) return null
        const keys = window.__lastKeepTest.toward(-me.x, -me.y)
        for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, keys.includes(key))
        return { x: me.x, y: me.y, alive: me.alive !== false, raiseReady: !!(button && !button.disabled) }
      })
  })
}

async function stepEastOfTheKeep(page) {
  // A single goal on the field row stops on the crop, and due west on the face
  // does not slide. Keep a heading while the server x keeps gaining. Turn when
  // that gain stops. The body still has to clear x 130 and radius 140, and the
  // wait stays 20 seconds.
  const headings = [
    ["KeyD", "KeyS"],
    ["KeyD"],
    ["KeyS"],
    ["KeyW", "KeyD"],
    ["KeyS", "KeyA"]
  ]
  let mark = null
  return walkUntil(page, {
    timeout: 20_000,
    label: "east of the keep",
    done: (me) => me.x > 130 && Math.hypot(me.x, me.y) > 140,
    step: async (current) => {
      const me = await current.evaluate(() => {
        const self = window.__lastKeep.self
        return self ? { x: self.x, y: self.y } : null
      })
      if (!me) return null
      const progress = noteProgress(mark, me.x, Date.now())
      mark = progress.mark
      await holdCodes(current, headings[mark.heading % headings.length])
      return me
    }
  })
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

  await sowFour(page)

  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(48)
  const open = await page.evaluate(() => {
    const rows = window.__lastKeep.structures || []
    return rows.some((row) => (row.x === 108 && row.y === 36) || (row.x === -108 && row.y === 36))
  })
  expect(open).toBe(false)

  await waitForRaiseGold(page)
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(48)
  await expect(page.locator("[data-raise]")).toBeDisabled()
  await walkToRaise(page)
  await expect(page.locator("[data-raise]")).toBeEnabled()
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
  await stepEastOfTheKeep(page)
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
  await walkUntil(page, {
    timeout: 15_000,
    label: "back to the keep",
    done: (state) => Math.hypot(state.x, state.y) < 140,
    step: async (current) => {
      await holdCodes(current, ["KeyS"])
      return current.evaluate(() => {
        const me = window.__lastKeep.self
        return me ? { x: me.x, y: me.y } : null
      })
    }
  })
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
  // until the west line is clear of the keep. Each leg returns on the server
  // position. The caps stay 8 seconds, 12 seconds, and 20 seconds.
  const startY = await page.evaluate(() => (window.__lastKeep.self ? window.__lastKeep.self.y : 0))
  let arrived = false
  let mark = null
  await walkUntil(page, {
    timeout: 8_000,
    label: "north of the keep",
    soft: true,
    done: (state) => {
      const step = noteNorth(mark, state.y, Date.now())
      mark = step.mark
      if (step.action === "arrived") {
        arrived = true
        return true
      }
      return step.action === "step-out"
    },
    step: async (current) => {
      await holdCodes(current, ["KeyW"])
      const y = await current.evaluate(() => (window.__lastKeep.self ? window.__lastKeep.self.y : null))
      return { y: y == null ? startY : y }
    }
  })
  if (!arrived) {
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
    let spin = 0
    let best = 0
    let since = Date.now()
    await walkUntil(page, {
      timeout: 12_000,
      label: "off the keep face",
      soft: true,
      done: (me) => Math.hypot(me.x, me.y) > 80 && (me.x < -80 || Math.abs(me.y) > 90),
      step: async (current) => {
        const me = await current.evaluate(() => {
          const self = window.__lastKeep.self
          return self ? { x: self.x, y: self.y } : null
        })
        if (me) {
          const dist = Math.hypot(me.x, me.y)
          if (dist > best + 4) {
            best = dist
            since = Date.now()
          } else if (Date.now() - since > 700) {
            spin = (spin + 1) % headings.length
            since = Date.now()
          }
        }
        await holdCodes(current, headings[spin])
        return me
      }
    })
  }
  await walkUntil(page, {
    timeout: 20_000,
    label: "west caption",
    done: (state) => state.x < -700,
    step: async (current) => {
      await holdCodes(current, ["KeyA", "KeyW"])
      return current.evaluate(() => {
        const self = window.__lastKeep.self
        return self ? { x: self.x, y: self.y } : null
      })
    }
  })
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
  // Four guest windows cover this page. A frame promise never resolves there,
  // and the 150s test budget dies on the first viewport. The overlap poll is the layout wait.
  await page.bringToFront()
  for (const [width, height] of PHONE_SIZES) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.evaluate(phoneOverlaps), { timeout: 4_000 }).toEqual([])
  }
}

// Holds whatever `step` sets. The first sample inside the goal still has
// those keys down, and the hero keeps that step until the key-up reaches
// the server. Arrival is two later snapshots that share a position, with
// the keys already up, and that sample still has to satisfy `done`. The
// wait stays inside `timeout`. A timeout throws the last position, unless
// `soft` is set for a leg that has another plan.
async function walkUntil(page, { timeout, label, poll = 100, step, done, soft = false }) {
  const deadline = Date.now() + timeout
  let last = null
  try {
    while (Date.now() < deadline) {
      last = await step(page)
      if (last && done(last)) {
        const settled = await stoppedSample(page, last, deadline)
        if (settled && done(settled)) return settled
        last = settled || last
        continue
      }
      await page.waitForTimeout(poll)
    }
  } finally {
    await releaseCodes(page)
  }
  if (soft) return last
  throw new Error(`${label} timed out at ${JSON.stringify(last)}`)
}

async function stoppedSample(page, last, deadline) {
  await releaseCodes(page)
  let previous = null
  while (Date.now() < deadline) {
    const fresh = await page.evaluate(() => {
      const game = window.__lastKeep
      const me = game && game.self
      if (!me || typeof game.tick !== "number") return null
      const bar = document.querySelector("[data-raise]")
      const touch = document.querySelector("[data-touch-context]")
      return {
        x: me.x,
        y: me.y,
        alive: me.alive !== false,
        tick: game.tick,
        raiseReady: Boolean(
          (bar && !bar.disabled) || (touch && !touch.hidden && touch.getAttribute("aria-disabled") === "false")
        ),
        held: Math.hypot(me.x, me.y - 160) < 70,
        cloth: !!(game.table && game.table.cloth),
        table: game.table || null
      }
    })
    if (fresh && stoppedTick(previous, fresh)) return settleFields(last, fresh)
    if (fresh) previous = fresh
    const mark = fresh ? fresh.tick : null
    if (Date.now() >= deadline) break
    if (mark == null) {
      await page.waitForFunction(() => window.__lastKeep && typeof window.__lastKeep.tick === "number")
    } else {
      await page
        .waitForFunction((tick) => window.__lastKeep.tick !== tick, mark, { timeout: Math.max(1, deadline - Date.now()) })
        .catch(() => {})
    }
  }
  return null
}

async function steer(page, goal, done, timeout, label) {
  return walkUntil(page, {
    timeout,
    label,
    poll: 80,
    done,
    step: (current) =>
      current.evaluate((goal) => {
        const me = window.__lastKeep.self
        const callText = [...document.querySelectorAll(".hint-arrow")].map((node) => node.textContent || "").join(" ")
        const call = /goblin/i.test(callText)
        const keys = window.__lastKeepTest.around(goal.x, goal.y)
        for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, keys.includes(key))
        const bar = document.querySelector("[data-raise]")
        const touch = document.querySelector("[data-touch-context]")
        const raiseReady = Boolean(
          (bar && !bar.disabled) || (touch && !touch.hidden && touch.getAttribute("aria-disabled") === "false")
        )
        return me ? { x: me.x, y: me.y, alive: me.alive !== false, call, callText, raiseReady } : null
      }, goal)
  })
}

async function phoneClear(browser) {
  const errors = []
  const context = await lowContext(browser, {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  const page = await context.newPage()
  watch(page, "phone", errors)
  await page.goto(gameUrl("/"))
  await page.locator("#start-button").waitFor()
  await page.locator("#player-name").fill("Nia")
  await pickClass(page, "farmer")
  await page.locator("#start-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await waitForSeats(page, ["Nia"])
  const code = await page.evaluate(() => document.body.dataset.code)
  const party = [
    ["Ada", "warrior"],
    ["Lux", "mage"],
    ["Bram", "engineer"],
    ["Pip", "scout"]
  ]
  const seats = await joinTogether(
    ([name, hero]) => joinQuery(browser, code, name, hero, (guest) => watch(guest, name, errors)),
    party
  )
  await page.bringToFront()
  await waitForSeats(page, ["Nia", "Ada", "Lux", "Bram", "Pip"])
  for (const seat of seats) await seat.page.evaluate(() => window.__lastKeepTest.quiet())
  await assertPhoneClear(page)
  await sowFour(page)
  await waitForRaiseGold(page)
  await expect(page.locator("[data-raise]")).toBeDisabled()
  await walkToRaise(page)
  await expect(page.locator("[data-raise]")).toBeEnabled()
  await page.locator("[data-raise]").click()
  await page.waitForFunction(() => window.__lastKeep.town === 1, undefined, { polling: 100 })
  await assertPhoneClear(page)
  // The guests stand on the join ring. The raise leaves the host on the keep
  // face, so the far pose starts from the east again.
  await stepEastOfTheKeep(page)
  await assertFarCaptions(page)
  await assertPhoneClear(page)
  await page.locator("[data-start]").click()
  // The same covered page never runs requestAnimationFrame, so the default
  // poll sat through the whole build even after the server had opened the wave.
  await page.bringToFront()
  await page.waitForFunction(() => window.__lastKeep.phase === "wave", undefined, { polling: 100 })
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
  const called = await steer(
    page,
    { x: away, y: -210 },
    (state) =>
      state.alive && /goblin/i.test(state.callText) && state.y < -160 && Math.hypot(state.x, state.y) > 400,
    25_000,
    "goblin call away from the pack"
  )
  expect(called.callText).toMatch(/goblin/i)
  await assertPhoneClear(page)
  // A resize lets a goblin walk into the frame and the arrow goes with it.
  // The next sample is the one where the call is painted again, not a timer.
  for (const [width, height] of PHONE_SIZES) {
    await page.setViewportSize({ width, height })
    const seen = await walkUntil(page, {
      timeout: 15_000,
      label: "goblin call on the phone",
      poll: 100,
      done: (state) =>
        state.alive &&
        /goblin/i.test(state.callText) &&
        state.overlaps.length === 0 &&
        state.y < -160 &&
        Math.hypot(state.x, state.y) > 400,
      step: (current) =>
        current.evaluate(() => {
          const game = window.__lastKeep
          const me = game && game.self
          if (!me) return null
          const goblins = (game.monsters || []).filter((row) => row.kind === "goblin")
          const pack = goblins.length ? goblins.reduce((sum, row) => sum + row.x, 0) / goblins.length : me.x
          const callText = [...document.querySelectorAll(".hint-arrow")].map((node) => node.textContent || "").join(" ")
          const showing = /goblin/i.test(callText)
          const goalX = showing ? me.x : pack >= me.x ? me.x - 80 : me.x + 80
          const keys = showing ? [] : window.__lastKeepTest.around(goalX, -210)
          for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, keys.includes(key))
          const shown = (node) => {
            if (!node || node.hidden) return null
            const style = getComputedStyle(node)
            if (style.display === "none" || style.visibility === "hidden") return null
            const box = node.getBoundingClientRect()
            if (box.width < 1 || box.height < 1) return null
            return box
          }
          const nodes = [
            ...document.querySelectorAll(
              ".sack, [data-bonuses], [data-roster], .heart, [data-you], .hint-arrow, .chip, [data-touch], [data-touch-context], [data-build], .stick, [data-raise], [data-copy], [data-mute], [data-volume], [data-start]"
            )
          ]
          const boxes = nodes.map((node) => ({ node, box: shown(node) })).filter((row) => row.box)
          const overlaps = []
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i]
              const b = boxes[j]
              if (a.node.contains(b.node) || b.node.contains(a.node)) continue
              const overlapW = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left)
              const overlapH = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top)
              if (overlapW >= 1 && overlapH >= 1) overlaps.push(i)
            }
          }
          return { x: me.x, y: me.y, alive: me.alive !== false, callText, overlaps }
        })
    })
    expect(seen.callText).toMatch(/goblin/i)
    expect(seen.overlaps).toEqual([])
  }
  expect(errors, errors.join("\n")).toEqual([])
  for (const seat of seats) await seat.context.close()
  await context.close()
}

async function shotsDoNotGrowGeometries(browser) {
  const errors = []
  const { context, page } = await createHost(browser, "Lux", "mage")
  watch(page, "host", errors)
  await page.waitForFunction(() => {
    const perf = window.__lastKeepPerf
    if (!perf?.geometries) return false
    if (perf.mark !== perf.geometries) {
      perf.mark = perf.geometries
      perf.markAt = performance.now()
      return false
    }
    return performance.now() - perf.markAt > 500
  }, undefined, { timeout: 15_000 })
  const before = await page.evaluate(() => window.__lastKeepPerf.geometries)
  const canvas = page.locator("canvas")
  const box = await canvas.boundingBox()
  const x = box.x + box.width * 0.72
  const y = box.y + box.height * 0.42
  await page.mouse.click(x, y)
  await page.mouse.move(x, y)
  await page.mouse.down()
  let seen = 0
  try {
    await page.waitForFunction(() => (window.__lastKeep.projectiles || []).length > 1, undefined, { timeout: 3_000 })
    seen = await page.evaluate(() => (window.__lastKeep.projectiles || []).length)
  } catch (error) {
    if (!/Timeout/.test(String(error && error.message))) throw error
  } finally {
    await page.mouse.up()
  }
  expect(seen).toBeGreaterThan(1)
  await page.waitForFunction(() => (window.__lastKeep.projectiles || []).length === 0, undefined, { timeout: 8_000 })
  await page.waitForFunction(() => (window.__lastKeep.renders || 0) > 0)
  const after = await page.evaluate(() => window.__lastKeepPerf.geometries)
  expect(after).toBeLessThanOrEqual(before + 2)
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
}

function countFramebufferReads(page) {
  return page.addInitScript(() => {
    const mark = (proto) => {
      const orig = proto && proto.readPixels
      if (!orig || orig.__counted) return
      function counted(...args) {
        window.__lastKeepReads = (window.__lastKeepReads || 0) + 1
        return orig.apply(this, args)
      }
      counted.__counted = true
      proto.readPixels = counted
    }
    mark(WebGLRenderingContext.prototype)
    if (typeof WebGL2RenderingContext !== "undefined") mark(WebGL2RenderingContext.prototype)
  })
}

async function matchPaintsWithoutARead(browser) {
  const errors = []
  const { context, page } = await createHost(browser, "Nia", "farmer", async (host) => {
    watch(host, "host", errors)
    await countFramebufferReads(host)
  })
  await page.waitForFunction(() => (window.__lastKeep?.renders || 0) >= 4, undefined, { timeout: 15_000 })
  const during = await page.evaluate(() => window.__lastKeepReads || 0)
  expect(during).toBe(0)
  const graded = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.brightNear(me.x, me.y, 2)
  })
  expect(graded.field).toBeGreaterThan(0)
  const after = await page.evaluate(() => window.__lastKeepReads || 0)
  expect(after).toBeGreaterThan(during)
  await page.screenshot({ path: shot("paint-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
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

async function chopThePine(browser) {
  const errors = []
  const pine = { x: 432, y: 0 }
  const host = await createHost(browser, "Ada", "warrior", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      await route.continue({ postData: JSON.stringify({ ...body, seed: 5 }) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.self)
  await steerPast(
    page,
    pine,
    (state) => Math.hypot(state.x - pine.x, state.y - pine.y) < 14,
    20_000,
    "pine"
  )
  const before = await page.evaluate(() => window.__lastKeep.wood)
  await page.waitForFunction((mark) => window.__lastKeep.wood > mark, before, { timeout: 5_000 })
  const sack = await page.locator("[data-sack='wood']").innerText()
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  expect(sack).toContain(String(wood))
  expect(wood).toBeGreaterThan(before)
  await page.screenshot({ path: shot("pine-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function wakeTheCamp(browser) {
  const errors = []
  const chest = { x: 216, y: 720 }
  const camp = { x: -3852, y: -3384 }
  const host = await createHost(browser, "Ada", "warrior", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      await route.continue({ postData: JSON.stringify({ ...body, seed: 5 }) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.self)
  await steerPast(
    page,
    chest,
    (state) => Math.hypot(state.x - chest.x, state.y - chest.y) < 30,
    45_000,
    "chest"
  )
  await page.waitForFunction(() => window.__lastKeep.gold === 24, null, { timeout: 5_000 })
  await steerPast(
    page,
    camp,
    (state) => Math.hypot(state.x - camp.x, state.y - camp.y) < 30,
    120_000,
    "camp"
  )
  await page.waitForFunction(
    () => window.__lastKeep.gold === 16 && window.__lastKeep.vagrants.length === 1,
    null,
    { timeout: 5_000 }
  )
  const sack = await page.locator("[data-sack='gold']").innerText()
  const gold = await page.evaluate(() => window.__lastKeep.gold)
  expect(sack).toContain(String(gold))
  expect(await page.evaluate(() => window.__lastKeep.seats.length)).toBe(1)
  await page.screenshot({ path: shot("camp-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function takeTheShrine(browser) {
  const errors = []
  const shrine = { x: 4140, y: 0 }
  const host = await createHost(browser, "Ada", "warrior", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      await route.continue({ postData: JSON.stringify({ ...body, seed: 5 }) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.self)
  await steerPast(
    page,
    shrine,
    (state) => Math.hypot(state.x - shrine.x, state.y - shrine.y) < 30,
    120_000,
    "shrine"
  )
  await page.waitForFunction(() => window.__lastKeep.relics.length === 1, null, { timeout: 5_000 })
  expect(await page.evaluate(() => window.__lastKeep.seats.length)).toBe(1)
  await page.screenshot({ path: shot("shrine-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function holdTheLand(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      await route.continue({ postData: JSON.stringify({ ...body, seed: 5 }) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  // The seed-5 pine is cell (12, 0), center 432. cell_index rounds x/36, so
  // that cell is x in [414, 450). A warrior standing there pays 1 wood every
  // 12 ticks. The keep disc is meadow inside radius 400, and the yard trees
  // on this heading sit past that. A stand in (360, 414) keeps the hero off
  // the pine. The wall click is 80 ahead of the hero, so it lands outside the
  // disc. Wood is the count on the deny snapshot: a later chop tick cannot
  // land between the log line and the expect, and a spend still fails it.
  await steerPast(
    page,
    { x: 390, y: 0 },
    (state) => state.x > 360 && state.x < 414 && Math.abs(state.y) < 18,
    20_000,
    "short of the pine"
  )
  const outside = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return { x: me.x + 80, y: me.y }
  })
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  const denied = await refuseHeld(page, outside.x, outside.y)
  expect(denied.wood).toBe(wood)
  expect(denied.buildings).toBe(0)

  const portalGoal = { x: -1116, y: -1044 }
  await steerPast(
    page,
    portalGoal,
    (state) => Math.hypot(state.x - portalGoal.x, state.y - portalGoal.y) < 40,
    70_000,
    "portal"
  )
  const spot = await page.evaluate((goal) => {
    const me = window.__lastKeep.self
    const gcx = Math.floor(goal.x / 512)
    const gcy = Math.floor(goal.y / 512)
    const steps = [[36, 0], [-36, 0], [0, 36], [0, -36], [36, 36], [72, 0], [-72, 0], [0, 0]]
    for (const [dx, dy] of steps) {
      const x = me.x + dx
      const y = me.y + dy
      if (Math.floor(x / 512) === gcx && Math.floor(y / 512) === gcy) return { x, y }
    }
    return null
  }, portalGoal)
  if (!spot) throw new Error("no footing in the portal chunk")
  await refuseHeld(page, spot.x, spot.y)
  await pressKey(page, "Escape")
  const portal = await page.evaluate((goal) => {
    return (window.__lastKeep.portals || []).find((row) => Math.hypot(row.x - goal.x, row.y - goal.y) < 80)
  }, portalGoal)
  if (!portal) throw new Error("portal stayed hidden")
  const box = await page.locator("canvas").boundingBox()
  for (let swing = 0; swing < 6; swing += 1) {
    const gone = await page.evaluate((id) => !(window.__lastKeep.portals || []).some((row) => row.id === id), portal.id)
    if (gone) break
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    const swing = await page.evaluate((id) => {
      const row = (window.__lastKeep.portals || []).find((portal) => portal.id === id)
      return { tick: window.__lastKeep.tick, hp: row ? row.hp : 0 }
    }, portal.id)
    try {
      await page.waitForFunction(
        (mark) => {
          const row = (window.__lastKeep.portals || []).find((portal) => portal.id === mark.id)
          return !row || row.hp < mark.hp || window.__lastKeep.tick > mark.tick + 8
        },
        { id: portal.id, hp: swing.hp, tick: swing.tick }
      )
    } finally {
      await page.mouse.up()
    }
  }
  const broke = await page.evaluate((id) => !(window.__lastKeep.portals || []).some((row) => row.id === id), portal.id)
  if (!broke) throw new Error("portal still stands")
  await pressKey(page, "Digit1")
  const placed = await page.evaluate(({ x, y }) => window.__lastKeep.toClient(x, y), spot)
  const before = await page.evaluate(() => window.__lastKeep.wood)
  await page.mouse.click(placed.x, placed.y)
  await page.waitForFunction((mark) => window.__lastKeep.wood < mark && window.__lastKeep.buildings >= 1, before)
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function refuseHeld(page, x, y) {
  const armed = await page.locator('[data-build="wall"]').evaluate((node) => node.classList.contains("on"))
  if (!armed) await pressKey(page, "Digit1")
  const mark = await page.evaluate(() => (window.__lastKeep.log || []).length)
  const spot = await page.evaluate(({ x, y }) => window.__lastKeep.toClient(x, y), { x, y })
  await page.mouse.click(spot.x, spot.y)
  const denied = await page.waitForFunction(
    (before) => {
      const game = window.__lastKeep
      const hit = (game.log || [])
        .slice(before)
        .some((row) => row.type === "deny" && row.text === "The land is not held.")
      if (!hit) return null
      return { wood: game.wood, buildings: game.buildings }
    },
    mark
  )
  return denied.jsonValue()
}

async function steerPast(page, goal, done, timeout, label) {
  // steer() holds keysAround. A cardinal via on top of that step aims due
  // west again and sits on the face at x 73.5. The tangent is the detour.
  return steer(page, goal, done, timeout, label)
}

async function exploreLand(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      await route.continue({ postData: JSON.stringify({ ...body, seed: 5 }) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  await page.waitForFunction(() => (window.__lastKeep.chests || []).length > 0)
  const chest = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.chests.reduce((best, row) => {
      const dist = Math.hypot(row.x - me.x, row.y - me.y)
      return !best || dist < best.dist ? { ...row, dist } : best
    }, null)
  })
  const before = await page.evaluate(() => window.__lastKeep.gold)
  await steerPast(page, chest, (state) => Math.hypot(state.x - chest.x, state.y - chest.y) < 30, 45_000, "chest")
  await page.waitForFunction(
    (mark) => window.__lastKeep.gold === mark.before + 24 && !(window.__lastKeep.chests || []).some((row) => row.id === mark.id),
    { before, id: chest.id },
    { timeout: 8_000 }
  )
  const sack = await page.locator("[data-sack='gold']").innerText()
  expect(sack).toContain(String(before + 24))
  await page.screenshot({ path: shot("chest-host.png") })

  const portalGoal = { x: -1116, y: -1044 }
  await steerPast(
    page,
    portalGoal,
    (state) => Math.hypot(state.x - portalGoal.x, state.y - portalGoal.y) < 40,
    70_000,
    "portal"
  )
  const portal = await page.evaluate((goal) => {
    return (window.__lastKeep.portals || []).reduce((best, row) => {
      const dist = Math.hypot(row.x - goal.x, row.y - goal.y)
      return dist < 80 && (!best || dist < best.dist) ? { ...row, dist } : best
    }, null)
  }, portalGoal)
  if (!portal) throw new Error("portal stayed hidden")
  const bearing = Math.atan2(portal.y, portal.x)
  const box = await page.locator("canvas").boundingBox()
  for (let swing = 0; swing < 6; swing += 1) {
    const gone = await page.evaluate((id) => !(window.__lastKeep.portals || []).some((row) => row.id === id), portal.id)
    if (gone) break
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    const swing = await page.evaluate((id) => {
      const row = (window.__lastKeep.portals || []).find((portal) => portal.id === id)
      return { tick: window.__lastKeep.tick, hp: row ? row.hp : 0 }
    }, portal.id)
    try {
      await page.waitForFunction(
        (mark) => {
          const row = (window.__lastKeep.portals || []).find((portal) => portal.id === mark.id)
          return !row || row.hp < mark.hp || window.__lastKeep.tick > mark.tick + 8
        },
        { id: portal.id, hp: swing.hp, tick: swing.tick }
      )
    } finally {
      await page.mouse.up()
    }
  }
  const broke = await page.evaluate((id) => {
    const row = (window.__lastKeep.portals || []).find((portal) => portal.id === id)
    const me = window.__lastKeep.self
    return {
      gone: !row,
      hp: row ? row.hp : 0,
      x: me.x,
      y: me.y,
      cd: window.__lastKeep.attackCd || 0
    }
  }, portal.id)
  if (!broke.gone) {
    throw new Error(`portal still stands ${JSON.stringify(broke)}`)
  }
  const living = [
    { x: 360, y: -1692 },
    { x: 144, y: 1944 }
  ]
  await page.locator("[data-start]").click()
  await page.waitForFunction(() => window.__lastKeep.phase === "wave")
  const goblins = await page.evaluate(() => (window.__lastKeep.monsters || []).filter((row) => row.kind === "goblin"))
  expect(goblins).toHaveLength(2)
  const gap = (a, b) => {
    const diff = Math.abs(a - b)
    return Math.min(diff, Math.PI * 2 - diff)
  }
  for (const goblin of goblins) {
    const ang = Math.atan2(goblin.y, goblin.x)
    const liveGap = Math.min(...living.map((row) => gap(ang, Math.atan2(row.y, row.x))))
    expect(liveGap).toBeLessThan(0.05)
    expect(gap(ang, bearing)).toBeGreaterThan(liveGap)
  }
  await page.screenshot({ path: shot("portal-host.png") })
  expect(errors).toEqual([])
  await host.context.close()
}

function paintP95(paints) {
  if (!paints || paints.length === 0) return null
  const sorted = paints.slice().sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]
}

async function readMatch(page) {
  return page.evaluate(() => {
    const game = window.__lastKeep
    const perf = window.__lastKeepPerf || {}
    const self = game.self
    const monsters = game.monsters || []
    let nearest = null
    for (const monster of monsters) {
      if (!self) break
      const dist = Math.hypot(monster.x - self.x, monster.y - self.y)
      if (!nearest || dist < nearest.dist) nearest = { x: monster.x, y: monster.y, dist }
    }
    return {
      phase: game.phase,
      shownWave: game.shownWave,
      monsters: monsters.length,
      projectiles: (game.projectiles || []).length,
      keep: game.keep && game.keep.hp,
      keepMax: game.keep && game.keep.max,
      party: (game.party || []).length,
      geometries: perf.geometries || 0,
      textures: perf.textures || 0,
      calls: perf.calls || 0,
      triangles: perf.triangles || 0,
      rims: perf.rims || 0,
      census: perf.census || { inScene: 0, orphans: 0, pooled: 0, byRole: {}, settled: 0 },
      chests: (game.chests || []).length,
      portals: (game.portals || []).length,
      p95: null,
      paints: perf.paints || [],
      maxStep: perf.maxStep || 0,
      heap: performance.memory ? performance.memory.usedJSHeapSize : null,
      aim: nearest && self ? game.toClient(nearest.x, nearest.y) : null
    }
  })
}

async function sixSeatMatch(browser) {
  const errors = []
  const host = await createHost(browser, "Nia", "farmer", async (page) => {
    await page.route("**/api/rooms", async (route) => {
      const request = route.request()
      if (request.method() !== "POST" || !request.url().endsWith("/api/rooms")) {
        await route.continue()
        return
      }
      const body = request.postDataJSON()
      const perfKeepToken = process.env.PERF_KEEP_TOKEN || (process.env.BASE_URL ? "" : "playwright")
      const next = perfKeepToken ? { ...body, perf_keep_token: perfKeepToken } : body
      await route.continue({ postData: JSON.stringify(next) })
    })
  })
  const page = host.page
  watch(page, "host", errors)
  const code = new URL(page.url()).pathname.split("/").pop()
  const guests = []
  for (const [name, hero] of [
    ["Ada", "warrior"],
    ["Lux", "mage"],
    ["Bram", "engineer"],
    ["Pip", "scout"],
    ["Ned", "warrior"]
  ]) {
    const guest = await joinQuery(browser, code, name, hero)
    watch(guest.page, name, errors)
    await guest.page.evaluate(() => window.__lastKeepTest.quiet())
    guests.push(guest)
  }
  await page.waitForFunction(() => (window.__lastKeep.party || []).length >= 6)
  const engineer = guests[2].page
  await walkUntil(page, {
    timeout: 10_000,
    label: "engineer beside the keep",
    poll: 200,
    soft: true,
    done: (state) => state.close,
    step: async () => {
      await page.evaluate(() => window.__lastKeepTest.home())
      await Promise.all(guests.map((guest) => guest.page.evaluate(() => window.__lastKeepTest.follow())))
      return engineer.evaluate(() => {
        const self = window.__lastKeep.self
        return {
          x: self ? self.x : 0,
          y: self ? self.y : 0,
          close: !!self && Math.hypot(self.x, self.y) < 36
        }
      })
    }
  })
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2
    const x = Math.cos(angle) * 100
    const y = Math.sin(angle) * 100
    const tick = await engineer.evaluate(() => window.__lastKeep.tick)
    await engineer.evaluate(([wx, wy]) => window.__lastKeepTest.order("wall", wx, wy), [x, y])
    await engineer.waitForFunction((mark) => window.__lastKeep.tick > mark, tick)
  }
  await page.evaluate(() => window.__lastKeepTest.pictures())
  await page.locator("[data-start]").click()
  await page.waitForFunction(() => window.__lastKeep.phase === "wave")

  const builds = new Map()
  const troughs = new Map()
  const gcHeaps = new Map()
  const rimPairs = []
  let wavePeak = null
  let sawWave = false
  let last = null
  const started = Date.now()
  const seats = [page, ...guests.map((guest) => guest.page)]

  const fight = async (down) => {
    await Promise.all(seats.map((seat) => seat.evaluate((attack) => window.__lastKeepTest.fight(attack), down)))
  }

  try {
    while (Date.now() - started < 600_000) {
      const row = await readMatch(page)
      row.p95 = paintP95(row.paints)
      last = row
      delete last.paints
      if (row.phase === "over" || row.keep === 0) break
      if (row.phase === "wave") {
        sawWave = true
        if (row.monsters > 0 && row.rims > 0) {
          if (!wavePeak || row.calls > wavePeak.calls) {
            wavePeak = {
              shownWave: row.shownWave,
              monsters: row.monsters,
              rims: row.rims,
              calls: row.calls,
              triangles: row.triangles,
              p95: row.p95
            }
          }
        }
        if (row.rims > 0 && rimPairs.length < 5) {
          const pair = await page.evaluate(() => {
            const on = window.__lastKeepTest.repaint()
            if (!on.painted || !on.rims) return null
            window.__lastKeepTest.rims(false)
            const off = window.__lastKeepTest.repaint()
            window.__lastKeepTest.rims(true)
            window.__lastKeepTest.repaint()
            if (!off.painted) return null
            return { on, off }
          })
          if (pair) rimPairs.push(pair)
        }
        if (!gcHeaps.has(row.shownWave)) {
          const heap = await page.evaluate(() => {
            if (typeof window.gc === "function") {
              window.gc()
              window.gc()
            }
            return performance.memory ? performance.memory.usedJSHeapSize : null
          })
          gcHeaps.set(row.shownWave, heap)
        }
        await fight(true)
      } else {
        await fight(false)
        await page.evaluate(() => window.__lastKeepTest.home())
        await Promise.all(guests.map((guest) => guest.page.evaluate(() => window.__lastKeepTest.follow())))
        const shots = row.census?.byRole?.shot || 0
        const bodies = row.census?.byRole?.monster || 0
        // The snapshot can already list zero projectiles while the last paint
        // still holds the bolt. The same paint can still hold a body after
        // the snapshot lists no monsters. Either mesh made the later scene look larger.
        if (
          sawWave &&
          row.phase === "build" &&
          row.monsters === 0 &&
          row.projectiles === 0 &&
          shots === 0 &&
          bodies === 0 &&
          row.geometries > 0
        ) {
          if (!builds.has(row.shownWave)) {
            const sample = { ...row }
            delete sample.paints
            builds.set(row.shownWave, sample)
          }
          const slot = troughs.get(row.shownWave) || { min: row.heap }
          if (row.heap != null) slot.min = slot.min == null ? row.heap : Math.min(slot.min, row.heap)
          troughs.set(row.shownWave, slot)
        }
      }
      const early =
        row.phase === "wave"
          ? [...troughs.keys()].find(
              (wave) =>
                troughs.has(wave + 3) &&
                gcHeaps.has(wave) &&
                gcHeaps.has(wave + 3) &&
                row.shownWave >= wave + 3
            )
          : null
      if (early != null) {
        const first = builds.get(early)
        const later = builds.get(early + 3)
        const heaps = [gcHeaps.get(early), gcHeaps.get(early + 3)]
        const note = JSON.stringify({ first, later, heaps })
        expect(later.census.orphans, note).toBe(0)
        expect(settledHolds(first, later), note).toBe(true)
        // Heartwood, once, adds 280 to the perf keep. Any other max is a leak.
        const keepTops = [100000, 100280]
        expect(keepTops, note).toContain(first.keepMax)
        expect(keepTops, note).toContain(later.keepMax)
        expect(later.keepMax, note).toBeGreaterThanOrEqual(first.keepMax)
        expect(later.geometries, note).toBeLessThanOrEqual(later.census.inScene + later.census.pooled)
        expect(later.textures, note).toBeLessThanOrEqual(first.textures)
        expect(first.calls, note).toBeLessThanOrEqual(868)
        expect(later.calls, note).toBeLessThanOrEqual(868)
        expect(first.triangles, note).toBeLessThanOrEqual(11552)
        expect(later.triangles, note).toBeLessThanOrEqual(11552)
        expect(later.maxStep, note).toBeGreaterThan(0)
        expect(later.maxStep, note).toBeLessThanOrEqual(0.7 + 1e-6)
        expect(heaps[0], note).toBeGreaterThan(0)
        expect(heaps[1], note).toBeGreaterThan(0)
        break
      }
      const tick = await page.evaluate(() => window.__lastKeep.tick)
      await page.waitForFunction((mark) => window.__lastKeep.tick >= mark + 4, tick)
    }
  } finally {
    await fight(false)
    await page.evaluate(() => window.__lastKeepTest.rims(true)).catch(() => null)
  }

  // One six-seat run peaked at 447 calls and 6218 triangles on a frame with
  // a visible rim, and at 569 calls and 7778 triangles on any wave frame.
  // Hiding the rims on a frozen frame dropped exactly 1 call and 2 triangles
  // per rim the camera drew. A rim outside the frustum is not in that count.
  // 700 and 9800 sit above the run and under the empty-yard ceilings of 868
  // and 11552. Paint time is the perf job, not this match.
  expect(rimPairs.length).toBeGreaterThan(0)
  for (const pair of rimPairs) {
    expect(pair.off.rims).toBe(0)
    expect(pair.on.rims).toBeGreaterThan(0)
    expect(pair.on.calls - pair.off.calls).toBe(pair.on.rims)
    expect(pair.on.triangles - pair.off.triangles).toBe(pair.on.rims * 2)
  }
  expect(wavePeak && wavePeak.monsters > 0 && wavePeak.rims > 0, JSON.stringify(wavePeak)).toBe(true)
  expect(wavePeak.calls, JSON.stringify(wavePeak)).toBeLessThanOrEqual(700)
  expect(wavePeak.triangles, JSON.stringify(wavePeak)).toBeLessThanOrEqual(9800)

  const waves = [...builds.keys()]
  expect(waves.some((wave) => builds.has(wave + 3)), JSON.stringify({ waves, last })).toBe(true)
  expect(errors, errors.join("\n")).toEqual([])
  await page.screenshot({ path: shot("perf-host.png") })
  for (const guest of guests) await guest.context.close()
  await host.context.close()
}

async function raiseNeedsTheKeep(browser) {
  const errors = []
  await raiseOnTheBar(browser, errors)
  await raiseOnThePhone(browser, errors)
}

async function raiseOnTheBar(browser, errors) {
  const { context, page } = await createHost(browser, "Ada", "farmer")
  watch(page, "desk", errors)
  await sowFour(page)
  expect(await page.evaluate(() => window.__lastKeep.wood)).toBe(48)
  await waitForRaiseGold(page)
  const raise = page.locator("[data-raise]")
  const hit = page.locator("[data-raise-hit]")
  const reason = page.locator("[data-build-reason]")
  await expect(raise).toBeDisabled()
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return { x: me.x, y: me.y, wood: window.__lastKeep.wood, town: window.__lastKeep.town }
  })
  expect(Math.hypot(spot.x, spot.y)).toBeGreaterThanOrEqual(100)
  expect(spot.town).toBe(0)
  // Round 10 left Ada at (-122, -252). The click on the disabled raise
  // has to write the hint from that pose, not only from the spawn.
  const pose = await walkUntil(page, {
    timeout: 20_000,
    label: "raise pose",
    poll: 80,
    done: (state) => Math.hypot(state.x + 122, state.y + 252) <= 18,
    step: (current) =>
      current.evaluate(() => {
        const me = window.__lastKeep.self
        if (!me) return null
        const keys = window.__lastKeepTest.around(-122, -252)
        for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, keys.includes(key))
        return { x: me.x, y: me.y }
      })
  })
  expect(Math.hypot(pose.x + 122, pose.y + 252)).toBeLessThanOrEqual(18)
  await expect(raise).toBeDisabled()
  await hit.hover()
  await expect(reason).toHaveText("Walk to the keep")
  await page.mouse.move(1100, 700)
  await expect(reason).toBeHidden()
  await hit.click()
  await expect(reason).toHaveText("Walk to the keep")
  await page.mouse.move(1100, 700)
  await expect(reason).toHaveText("Walk to the keep")
  await walkToRaise(page)
  await expect(raise).toBeEnabled()
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  await raise.click()
  await page.waitForFunction((before) => window.__lastKeep.town === 1 && window.__lastKeep.wood <= before - 24, wood)
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
}

async function raiseOnThePhone(browser, errors) {
  const { context, page } = await createHost(browser, "Nia", "farmer", {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  watch(page, "phone", errors)
  await expect(page.locator("[data-touch-pad]")).toBeVisible()
  await sowFour(page)
  await waitForRaiseGold(page)
  const button = page.locator("[data-touch-context]")
  const reason = page.locator("[data-build-reason]")
  await expect(button).toBeVisible()
  await expect(button).toHaveText("Raise")
  await expect(button).toHaveAttribute("aria-disabled", "true")
  const away = await page.evaluate(() => Math.hypot(window.__lastKeep.self.x, window.__lastKeep.self.y))
  expect(away).toBeGreaterThanOrEqual(100)
  await button.tap({ force: true })
  await expect(reason).toHaveText("Walk to the keep")
  expect(await page.evaluate(() => window.__lastKeep.town)).toBe(0)
  await walkToRaise(page)
  await expect(button).toHaveAttribute("aria-disabled", "false")
  await expect(button).toHaveText("Raise")
  const wood = await page.evaluate(() => window.__lastKeep.wood)
  await button.tap()
  await page.waitForFunction((before) => window.__lastKeep.town === 1 && window.__lastKeep.wood <= before - 24, wood)
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
}

async function pictureGrade(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  const page = host.page
  watch(page, "host", errors)
  const read = (light) =>
    page
      .waitForFunction(
        (name) => {
          const game = window.__lastKeep
          if (!game || game.light !== name || typeof game.pictureGrade !== "function") return false
          if (name === "day" && (!game.hold || !(game.figures || []).length)) return false
          return game.pictureGrade()
        },
        light,
        { timeout: 20_000 }
      )
      .then((handle) => handle.jsonValue())
  const day = await read("day")
  await page.screenshot({ path: shot("picture-day.png") })
  await page.locator("[data-start]").click()
  const dusk = await read("dusk")
  const night = await read("night")
  const grades = { day, dusk, night }
  fs.writeFileSync(shot("picture-grade.json"), JSON.stringify(grades, null, 2))
  await page.screenshot({ path: shot("picture-night.png") })
  for (const grade of [day, dusk, night]) {
    expect(grade.mode, JSON.stringify(grade)).toBe("hd2d")
    expect(grade.fov).toBe(15)
    expect(grade.width).toBe(1280)
    expect(grade.height).toBe(800)
  }
  expect(Number.isFinite(day.crisp)).toBe(true)
  expect(Number.isFinite(day.miniature)).toBe(true)
  expect(Number.isFinite(day.shadows)).toBe(true)
  expect(Number.isFinite(dusk.chroma)).toBe(true)
  expect(Number.isFinite(night.pools)).toBe(true)
  expect(Number.isFinite(night.cap)).toBe(true)
  expect(Number.isFinite(night.halo)).toBe(true)
  expect(day.light).toBe("day")
  expect(dusk.light).toBe("dusk")
  expect(night.light).toBe("night")
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function readTheMap(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior")
  const page = host.page
  watch(page, "host", errors)
  // The cloth exists only inside radius 80. The sample that sees the hero
  // there clears the keys. The check reads the stopped sample.
  const report = await walkUntil(page, {
    timeout: 20_000,
    label: "table",
    poll: 80,
    done: (state) => state.held && state.cloth,
    step: (current) =>
      current.evaluate(() => {
        const game = window.__lastKeep
        const me = game.self
        if (!me) return null
        const held = Math.hypot(me.x, me.y - 160) < 70
        const keys = held ? [] : window.__lastKeepTest.around(0, 160)
        for (const key of ["KeyW", "KeyA", "KeyS", "KeyD"]) window.__lastKeepTest.hold(key, keys.includes(key))
        const chunkOf = (x, y) => `${Math.floor(x / 512)},${Math.floor(y / 512)}`
        const known = new Set((game.map && game.map.chunks ? game.map.chunks : []).map((chunk) => `${chunk.cx},${chunk.cy}`))
        const hidden = (game.chests || []).filter((row) => !known.has(chunkOf(row.x, row.y)))
        return {
          x: me.x,
          y: me.y,
          held,
          cloth: !!(game.table && game.table.cloth),
          table: game.table || null,
          explored: known.size,
          terrain: (game.chunks || []).length,
          hidden: hidden.length,
          builds: document.querySelectorAll(".build").length,
          mapButton: [...document.querySelectorAll("button")].some((node) => /map/i.test(node.textContent || ""))
        }
      })
  })
  expect(report.cloth).toBe(true)
  expect(report.table).toEqual({ x: 0, y: 160, cloth: true })
  expect(report.explored).toBeGreaterThan(0)
  expect(report.terrain).toBeLessThanOrEqual(25)
  expect(report.hidden).toBe(0)
  expect(report.builds).toBe(6)
  expect(report.mapButton).toBe(false)
  await assertDiegeticHud(page)
  await page.screenshot({ path: shot("map-table.png") })
  expect(errors, errors.join("\n")).toEqual([])
  await host.context.close()
}

async function hd2dFlag(browser) {
  const errors = []
  const host = await createHost(browser, "Ada", "warrior", (page) => watch(page, "host", errors))
  await host.page.waitForFunction(() => window.__lastKeep && window.__lastKeep.frame && window.__lastKeep.frame.mode === "hd2d")
  const plain = await host.page.evaluate(() => ({
    frame: window.__lastKeep.frame,
    picture: window.__lastKeepPicture || null,
    perf: document.querySelector("#hd2d-perf"),
    contact: window.__lastKeep.contact,
    search: window.location.search
  }))
  expect(plain.search).toBe("")
  expect(plain.frame.mode).toBe("hd2d")
  expect(plain.frame.fov).toBe(15)
  expect(plain.frame.bufferWidth).toBe(1280)
  expect(plain.frame.bufferHeight).toBe(800)
  expect(plain.picture).toBeTruthy()
  expect(plain.perf).toBeNull()
  expect(plain.contact).toBe("shadow")

  const code = new URL(host.page.url()).pathname.split("/").pop()
  const context = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  watch(page, "flag", errors)
  const posts = []
  page.on("request", (request) => {
    if (request.method() !== "POST") return
    const pathname = new URL(request.url()).pathname
    if (!pathname.endsWith("/join")) return
    posts.push(request.postDataJSON())
  })
  await page.goto(gameUrl(`/r/${code}?hd2d=1&perf=1&name=${encodeURIComponent("Lux")}&hero=mage`))
  await page.waitForFunction(() => window.__lastKeep && window.__lastKeep.frame && window.__lastKeep.frame.mode === "hd2d" && window.__lastKeep.frame.fov === 15)
  await page.waitForFunction(() => /ms/.test(document.querySelector("#hd2d-perf")?.textContent || ""))
  const flagged = await page.evaluate(() => ({
    frame: window.__lastKeep.frame,
    contact: window.__lastKeep.contact,
    perf: document.querySelector("#hd2d-perf").textContent
  }))
  expect(flagged.frame.mode).toBe("hd2d")
  expect(flagged.frame.fov).toBe(15)
  expect(flagged.frame.bufferWidth).toBe(1280)
  expect(flagged.frame.bufferHeight).toBe(800)
  expect(flagged.contact).toBe("shadow")
  expect(flagged.perf).toContain("frame")
  expect(posts.length).toBeGreaterThan(0)
  expect(posts[0].name).toBe("Lux")
  expect(posts[0].hero).toBe("mage")
  expect(posts[0].hd2d).toBeUndefined()
  expect(posts[0].perf).toBeUndefined()

  const stillContext = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const still = await stillContext.newPage()
  watch(still, "still", errors)
  await still.goto(gameUrl(`/r/${code}`))
  await still.waitForFunction(() => window.__lastKeepPicture && typeof window.__lastKeepPicture.grade === "function")
  const graded = await still.evaluate(async () => {
    const buffers = await window.__lastKeepPicture.grade()
    return buffers.map((buffer) => ({
      width: buffer.width,
      height: buffer.height,
      bytes: buffer.rgba.length,
      frameMs: buffer.frameMs
    }))
  })
  expect(graded).toHaveLength(3)
  for (const buffer of graded) {
    expect(buffer.width).toBe(1280)
    expect(buffer.height).toBe(800)
    expect(buffer.bytes).toBe(buffer.width * buffer.height * 4)
    expect(buffer.frameMs).toBeGreaterThan(0)
  }
  expect(errors, errors.join("\n")).toEqual([])
  await stillContext.close()
  await context.close()
  await host.context.close()
}

async function classSelect(browser) {
  const errors = []
  const desktop = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const page = await desktop.newPage()
  watch(page, "class", errors)
  await page.goto(gameUrl("/"))
  await page.locator("#start-button").waitFor()
  await page.locator("#stage").click({ position: { x: 24, y: 24 } })
  const keyed = []
  for (let i = 0; i < 5; i += 1) {
    keyed.push(await page.locator("[data-class-name]").innerText())
    await page.keyboard.press("ArrowRight")
  }
  expect(new Set(keyed).size).toBe(5)
  await page.waitForFunction(() => {
    const figure = window.__lastKeep && window.__lastKeep.figures && window.__lastKeep.figures[0]
    return figure && figure.hero === document.querySelector("#start-screen").dataset.hero
  })
  await desktop.close()

  const phone = await lowContext(browser, {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true
  })
  const touch = await phone.newPage()
  watch(touch, "touch", errors)
  await touch.goto(gameUrl("/"))
  await touch.locator("#start-button").waitFor()
  const swiped = []
  for (let i = 0; i < 5; i += 1) {
    swiped.push(await touch.locator("[data-class-name]").innerText())
    await touch.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", clientX: 500, clientY: 180, bubbles: true }))
      window.dispatchEvent(new PointerEvent("pointerup", { pointerType: "touch", clientX: 360, clientY: 180, bubbles: true }))
    })
  }
  expect(new Set(swiped).size).toBe(5)
  await touch.locator("#player-name").fill("Nia")
  await pickClass(touch, "farmer")
  await touch.locator("#start-button").click()
  await touch.waitForURL(/\/r\/[A-Z0-9]+$/)
  await waitForSeats(touch, ["Nia"])
  const seats = await touch.evaluate(() => window.__lastKeep.seats)
  expect(seats).toHaveLength(1)
  expect(seats[0].name).toBe("Nia")
  expect(seats[0].hero).toBe("farmer")
  expect(errors, errors.join("\n")).toEqual([])
  await phone.close()
}

async function oneSeat(browser) {
  const errors = []
  const context = await lowContext(browser, { viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.__seatAsked = 0
    const mark = () => {
      if (!location.pathname.startsWith("/r/")) return
      const start = document.querySelector("#start-screen")
      const join = document.querySelector("#join-game")
      if ((start && !start.hidden) || (join && !join.hidden)) window.__seatAsked += 1
    }
    const arm = (root) => {
      new MutationObserver(mark).observe(root, {
        attributes: true,
        subtree: true,
        childList: true,
        attributeFilter: ["hidden"]
      })
      mark()
    }
    if (document.documentElement) arm(document.documentElement)
    else {
      new MutationObserver(() => {
        if (!document.documentElement) return
        arm(document.documentElement)
      }).observe(document, { childList: true })
    }
  })
  watch(page, "seat", errors)
  await page.goto(gameUrl("/"))
  await page.locator("#start-button").waitFor()
  expect(await page.locator("#player-name").count()).toBe(1)
  await page.locator("#player-name").fill("Ada")
  await pickClass(page, "scout")
  await page.locator("#start-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await waitForSeats(page, ["Ada"])
  const first = await page.evaluate(() => ({
    asked: window.__seatAsked,
    hidden: document.querySelector("#start-screen").hidden,
    seats: window.__lastKeep.seats
  }))
  expect(first.asked).toBe(0)
  expect(first.hidden).toBe(true)
  expect(first.seats).toHaveLength(1)
  expect(first.seats[0].hero).toBe("scout")

  await page.reload()
  await waitForSeats(page, ["Ada"])
  const reloaded = await page.evaluate(() => ({
    asked: window.__seatAsked,
    hidden: document.querySelector("#start-screen").hidden,
    seats: window.__lastKeep.seats
  }))
  expect(reloaded.asked).toBe(0)
  expect(reloaded.hidden).toBe(true)
  expect(reloaded.seats).toHaveLength(1)

  await page.evaluate(() => window.__lastKeepTest.forget())
  await page.reload()
  await waitForSeats(page, ["Ada"])
  const recovered = await page.evaluate(() => ({
    asked: window.__seatAsked,
    hidden: document.querySelector("#start-screen").hidden,
    seats: window.__lastKeep.seats
  }))
  expect(recovered.asked).toBe(0)
  expect(recovered.hidden).toBe(true)
  expect(recovered.seats).toHaveLength(1)
  expect(recovered.seats[0].hero).toBe("scout")
  expect(errors, errors.join("\n")).toEqual([])
  await context.close()
}

module.exports = {
  prepareProof,
  proofDir,
  gameUrl,
  createHost,
  joinQuery,
  twoPlayerNight,
  joinFromForm,
  classSelect,
  oneSeat,
  squarePixels,
  scoreList,
  heroSilhouettes,
  paradeShowsEveryKind,
  matchPaintsWithoutARead,
  shotsDoNotGrowGeometries,
  sixSeatMatch,
  pictureGrade,
  mobileTouch,
  townGrows,
  captionsClearTheBuilds,
  phoneClear,
  exploreLand,
  chopThePine,
  wakeTheCamp,
  takeTheShrine,
  holdTheLand,
  readTheMap,
  raiseNeedsTheKeep,
  hd2dFlag
}
