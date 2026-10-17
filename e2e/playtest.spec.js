const { test, expect } = require("@playwright/test")
const { openParty, readState, keyInPage } = require("./playtest/room")

test("five specialists share one room and the warrior can walk", async ({ browser }) => {
  const party = await openParty(browser)
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
    await expect(seat.page.locator("[data-roster]")).toContainText("Ada")
    await expect(seat.page.locator("[data-roster]")).toContainText(seat.name)
  }
  const ada = party.seats[0].page
  await expect(ada.locator("[data-hp]")).toContainText("Ada")
  await expect(ada.locator(".who.me")).toContainText("Ada")
  await expect(ada.locator("[data-you]")).toBeVisible()
  await expect(ada.locator("[data-you]")).toHaveText("Ada")
  await expect(ada.locator("[data-next]")).toContainText("2 goblins")
  const copy = await ada.locator("[data-copy]").boundingBox()
  expect(copy.x).toBeGreaterThan(0)
  expect(copy.x + copy.width).toBeLessThanOrEqual(1280)
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
