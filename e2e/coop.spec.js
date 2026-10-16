const { test, expect } = require("@playwright/test")
const fs = require("fs")
const path = require("path")

const proof = path.join("tmp", "verify-artifacts")

test.beforeAll(() => {
  fs.mkdirSync(proof, { recursive: true })
})

test.use({ viewport: { width: 1280, height: 800 } })

test("two players start the night, place a wall, and kill a goblin on screen", async ({ browser }) => {
  const host = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await host.newPage()
  const friend = await guest.newPage()
  const errors = []
  for (const [label, tab] of [
    ["host", page],
    ["guest", friend]
  ]) {
    tab.on("pageerror", (error) => errors.push(`${label} ${error.message}`))
    tab.on("console", (message) => {
      if (message.type() === "error") errors.push(`${label} ${message.text()}`)
    })
  }

  await page.goto("/")
  await page.locator("#player-name").fill("Bob")
  await page.locator('input[value="warrior"]').check()
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  await page.waitForFunction(() => document.querySelector("[data-roster]")?.innerText?.includes("Bob"))

  const code = await page.evaluate(() => document.body.dataset.code)
  await friend.goto(`/r/${code}?name=LLL&hero=mage`)
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return roster.includes("LLL") && roster.includes("Bob") && document.querySelector("#join-game")?.hidden
  })
  await page.waitForFunction(() => document.querySelector("[data-roster]")?.innerText?.includes("LLL"))
  await expect(page.locator("[data-roster]")).toContainText("Warrior")
  await expect(friend.locator("[data-roster]")).toContainText("Mage")
  await expect(page.locator("[data-clock]")).toHaveText("Waiting to start")
  await expect(page.locator('[data-skill-name="attack"]')).toHaveText("Strike")
  await expect(friend.locator('[data-skill-name="q"]')).toHaveText("Fireball")
  await expect(page.locator('[data-build="wall"]')).toContainText("8 wood")
  await page.screenshot({ path: path.join(proof, "coop-host.png") })
  await friend.screenshot({ path: path.join(proof, "coop-guest.png") })

  const wood = await page.evaluate(() => window.__lastKeep.wood)
  await page.keyboard.press("Digit1")
  const spot = await page.evaluate(() => {
    const me = window.__lastKeep.self
    return window.__lastKeep.toClient(me.x + 48, me.y + 8)
  })
  await page.mouse.click(spot.x, spot.y)
  await page.waitForFunction((before) => window.__lastKeep.wood < before && window.__lastKeep.buildings >= 1, wood)
  await page.keyboard.press("Escape")
  await page.screenshot({ path: path.join(proof, "wall-host.png") })

  await expect(page.locator("[data-start]")).toHaveText("Start the night")
  await expect(friend.locator("[data-start]")).toHaveText("Waiting for the host")
  await page.locator("[data-start]").click()
  await page.waitForFunction(() => window.__lastKeep.phase === "wave", { timeout: 20_000 })
  const onYard = () => {
    const game = window.__lastKeep
    return (
      game.monsters.length >= 2 &&
      game.monsters.every((monster) => monster.onScreen) &&
      game.monsters.some((monster) => game.redNear(monster.x, monster.y) > 8)
    )
  }
  await page.waitForFunction(onYard)
  await friend.waitForFunction(onYard)
  const edgeLabels = await page.locator("[data-hints]").innerText()
  expect(edgeLabels).not.toMatch(/goblin \d/)
  await expect(page.locator("[data-clock]")).toContainText("Frenzy")
  await page.screenshot({ path: path.join(proof, "wave-host.png") })
  await friend.screenshot({ path: path.join(proof, "wave-guest.png") })

  const sameKeep = await Promise.all([
    page.evaluate(() => window.__lastKeep.keep.hp),
    friend.evaluate(() => window.__lastKeep.keep.hp)
  ])
  expect(Math.abs(sameKeep[0] - sameKeep[1])).toBeLessThan(40)

  await fight(page, friend)
  await page.waitForFunction(() => window.__lastKeep.kills >= 1, { timeout: 30_000 })
  await page.waitForFunction(
    () => window.__lastKeep.phase === "build" && window.__lastKeep.keep.hp > 0 && window.__lastKeep.kills >= 1,
    { timeout: 45_000 }
  )
  await page.screenshot({ path: path.join(proof, "cleared-host.png") })
  expect(errors, errors.join("\n")).toEqual([])
})

test("the join form on a bare invite enters the same room", async ({ browser }) => {
  const host = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await host.newPage()
  const friend = await guest.newPage()

  await page.goto("/")
  await page.locator("#player-name").fill("Ada")
  await page.locator("#create-button").click()
  await page.waitForURL(/\/r\/[A-Z0-9]+$/)
  const code = await page.evaluate(() => document.body.dataset.code)

  await friend.goto(`/r/${code}`)
  await expect(friend.locator("#join-game")).toBeVisible()
  await friend.locator("#player-name").fill("Bo")
  await friend.locator('input[value="engineer"]').check()
  await friend.locator('#join-game button[type="submit"]').click()
  await friend.waitForFunction(() => {
    const roster = document.querySelector("[data-roster]")?.innerText || ""
    return roster.includes("Bo") && roster.includes("Ada") && document.querySelector("#join-game").hidden
  })
  await friend.screenshot({ path: path.join(proof, "form-join.png") })
})

test("the high score list hides scoreless runs", async ({ request }) => {
  const response = await request.get("/api/highscores")
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  for (const row of body.scores || []) {
    expect(row.score).toBeGreaterThan(0)
    expect((row.names || []).join("").trim().length).toBeGreaterThan(0)
  }
})

async function fight(page, friend) {
  const started = Date.now()
  let hostKey = null
  let guestKey = null
  while (Date.now() - started < 50_000) {
    const phase = await page.evaluate(() => window.__lastKeep.phase)
    if (phase !== "wave") break
    hostKey = await step(page, hostKey)
    guestKey = await step(friend, guestKey)
    await page.waitForTimeout(250)
  }
  if (hostKey) await page.keyboard.up(hostKey)
  if (guestKey) await friend.keyboard.up(guestKey)
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
    return { key, dist, click: game.toClient(monster.x, monster.y) }
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
  return plan.dist > 36 ? plan.key : null
}
