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
  const before = await readState(party.seats[0].page)
  await act(party.seats[0].page, { hold: ["KeyW"], ms: 700 })
  const after = await readState(party.seats[0].page)
  const travel = Math.hypot(after.self.x - before.self.x, after.self.y - before.self.y)
  expect(travel).toBeGreaterThan(20)
  expect(after.hold).toBe(true)
  await party.close()
})
