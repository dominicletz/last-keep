const { test, expect } = require("@playwright/test")
const { openParty, act, readState } = require("./playtest/room")

test("four heroes share one room and the warrior can walk", async ({ browser }) => {
  const party = await openParty(browser)
  const names = party.seats.map((seat) => seat.name)
  expect(names).toEqual(["Ada", "Lux", "Bram", "Pip"])
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
  await act(party.seats[0].page, { hold: ["KeyW"], ms: 700 })
  const after = await readState(party.seats[0].page)
  const travel = Math.hypot(after.self.x - before.self.x, after.self.y - before.self.y)
  expect(travel).toBeGreaterThan(20)
  expect(after.hold).toBe(true)
  await party.close()
})
