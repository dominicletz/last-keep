const { test, expect } = require("@playwright/test")
const { openParty, readState, keyInPage } = require("./playtest/room")

test("five specialists share one room and the warrior can walk", async ({ browser }) => {
  const party = await openParty(browser)
  for (const seat of party.seats) {
    if (seat.name === "Ada" || seat.name === "Lux") continue
    await seat.page.evaluate(() => window.__lastKeepTest.quiet())
  }
  const names = party.seats.map((seat) => seat.name)
  expect(names).toEqual(["Ada", "Lux", "Bram", "Pip", "Nia"])
  expect(party.seats.map((seat) => seat.persona)).toEqual([
    "gameplay",
    "graphics",
    "music",
    "logic",
    "character"
  ])
  for (const seat of party.seats) {
    await seat.page.bringToFront()
    await expect(seat.page.locator("[data-roster]")).toContainText("Ada")
    await expect(seat.page.locator("[data-roster]")).toContainText(seat.name)
  }
  const lux = party.seats[1].page
  await lux.evaluate(() => window.__lastKeepTest.wake())
  const idleStart = await lux.evaluate(() => window.__lastKeep.renders || 0)
  await lux.waitForFunction((mark) => (window.__lastKeep.renders || 0) > mark, idleStart)
  const ada = party.seats[0].page
  await expect(ada.locator("[data-hp]")).toContainText("Ada")
  await expect(ada.locator(".who.me")).toContainText("Ada")
  await expect(ada.locator("[data-you]")).toBeVisible()
  await expect(ada.locator("[data-you]")).toHaveText("Ada")
  await expect(ada.locator("[data-next]")).toContainText("2 goblins")
  await expect(ada.locator(".sack")).toHaveCount(3)
  await expect(ada.locator("[data-stock]")).toContainText("Wood")
  await expect(ada.locator("[data-stock]")).toContainText("Food")
  await expect(ada.locator("[data-sack='food']")).toContainText("Feast 10")
  await expect(ada.locator("[data-stock]")).toContainText("Gold")
  await expect(ada.locator(".hint-arrow.beacon:not(.land)")).toHaveCount(1)
  await expect(ada.locator(".hint-arrow.beacon:not(.land)")).toContainText("2 goblins")
  const landMarks = await ada.locator(".hint-arrow.land").allTextContents()
  expect(landMarks.length).toBeLessThanOrEqual(2)
  for (const text of landMarks) expect(["chest", "portal"]).toContain(text.trim())
  expect(await ada.locator("[data-chrome]").count()).toBe(10)
  await expect(ada.locator("[data-raise]")).toBeDisabled()
  const raisePaint = await ada.locator("[data-raise]").evaluate((node) => getComputedStyle(node).borderTopColor)
  const livePaint = await ada.locator("[data-copy]").evaluate((node) => getComputedStyle(node).borderTopColor)
  expect(raisePaint).not.toBe(livePaint)
  const copy = await ada.locator("[data-copy]").boundingBox()
  const raise = await ada.locator("[data-raise]").boundingBox()
  const roster = await ada.locator("[data-roster]").boundingBox()
  for (const box of [copy, raise, roster]) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1280)
    expect(box.y + box.height).toBeLessThanOrEqual(800)
  }
  const sign = await ada.locator(".chip").boundingBox()
  expect(overlaps(copy, roster)).toBe(false)
  expect(overlaps(raise, roster)).toBe(false)
  expect(overlaps(sign, roster)).toBe(false)
  const before = await readState(ada)
  await keyInPage(ada, "KeyW", true)
  try {
    await expect
      .poll(
        async () => {
          const now = await readState(ada)
          return Math.hypot(now.self.x - before.self.x, now.self.y - before.self.y)
        },
        { timeout: 5000 }
      )
      .toBeGreaterThan(20)
  } finally {
    await keyInPage(ada, "KeyW", false)
  }
  expect((await readState(ada)).hold).toBe(true)
  await party.close()
})

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
