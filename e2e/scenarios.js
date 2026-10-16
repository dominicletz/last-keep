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

async function createHost(browser, name, hero) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto("/")
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
  await page.goto(`/r/${code}?name=${encodeURIComponent(name)}&hero=${hero}`)
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
  await page.keyboard.press("Digit1")
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
  if (!armed) await page.keyboard.press("Digit1")
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
  await page.waitForFunction(() => {
    const game = window.__lastKeep
    return (
      game.phase === "wave" &&
      game.monsters.length >= 2 &&
      game.monsters.every((monster) => monster.onScreen) &&
      game.monsters.some((monster) => game.redNear(monster.x, monster.y) > 8)
    )
  })
  const edgeLabels = await page.locator("[data-hints]").innerText()
  expect(edgeLabels).not.toMatch(/goblin \d/)
  await expect(page.locator("[data-clock]")).toContainText("Frenzy")
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
  const click = await friend.evaluate(() => {
    const game = window.__lastKeep
    const monster = (game.monsters || [])[0]
    return monster ? game.toClient(monster.x, monster.y) : null
  })
  expect(click).toBeTruthy()
  await friend.mouse.click(click.x, click.y)
  await friend.mouse.click(click.x, click.y)
  await friend.keyboard.press("q")
  try {
    await friend.waitForFunction(() => {
      const game = window.__lastKeep
      const flying = (game.projectiles || []).some((shot) => shot.kind === "fireball")
      const seen = (game.kinds || []).includes("fireball")
      return flying || seen
    })
  } catch (err) {
    const debug = await friend.evaluate(() => ({
      cds: window.__lastKeep.cds,
      kinds: window.__lastKeep.kinds,
      projectiles: window.__lastKeep.projectiles,
      hero: window.__lastKeep.self && window.__lastKeep.self.hero,
      log: window.__lastKeep.log
    }))
    throw new Error(`fireball was not on screen ${JSON.stringify(debug)}`)
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
  if (hostKey) await page.keyboard.up(hostKey)
  if (guestKey) await friend.keyboard.up(guestKey)
  await sample(page, notes)
  await sample(friend, notes)
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
  if (held && held !== plan.key) await tab.keyboard.up(held)
  if (plan.dist > 36) await tab.keyboard.down(plan.key)
  else if (held) await tab.keyboard.up(held)
  const viewport = tab.viewportSize()
  const inside =
    plan.click.x > 8 &&
    plan.click.y > 8 &&
    plan.click.x < viewport.width - 8 &&
    plan.click.y < viewport.height - 8
  if (inside) await tab.mouse.click(plan.click.x, plan.click.y)
  if (plan.hero === "mage") await tab.keyboard.press("q")
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
  await expect(page.locator("[data-wave]")).toHaveText("Wave 1")
  await expect(page.locator('[data-skill-name="attack"]')).toHaveText("Strike")
  await expect(friend.locator('[data-skill-name="q"]')).toHaveText("Fireball")
  await expect(page.locator('[data-build="wall"]')).toContainText("8 wood")
  await expect(page.locator("[data-score]")).toHaveText("Score 0")
  await assertBonuses(page)
  await page.screenshot({ path: shot("coop-host.png") })
  await friend.screenshot({ path: shot("coop-guest.png") })

  await focusClickDoesNotAttack(page)
  await clickDoesNotSpendWithoutABuilding(page)
  await invalidPlacementExplains(page)
  await movementIsInterpolated(page)
  await placeWall(page)

  await expect(page.locator("[data-start]")).toHaveText("Start the night")
  await expect(friend.locator("[data-start]")).toHaveText("Waiting for the host")
  await page.locator("[data-start]").click()
  await expectGoblinsOnYard(page)
  await expectGoblinsOnYard(friend)
  const sameKeep = await Promise.all([
    page.evaluate(() => window.__lastKeep.keep.hp),
    friend.evaluate(() => window.__lastKeep.keep.hp)
  ])
  expect(Math.abs(sameKeep[0] - sameKeep[1])).toBeLessThan(40)
  await page.screenshot({ path: shot("wave-host.png") })
  await friend.screenshot({ path: shot("wave-guest.png") })

  const notes = blankNotes()
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
  await page.keyboard.down("KeyW")
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
  await page.keyboard.up("KeyW")
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
  twoPlayerNight,
  joinFromForm,
  squarePixels,
  scoreList
}
