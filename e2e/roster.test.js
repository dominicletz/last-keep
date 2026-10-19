const assert = require("node:assert/strict")
const { test } = require("node:test")
const { joinTogether, rosterReady } = require("./roster")

const NAMES = ["Nia", "Ada", "Lux", "Bram", "Pip"]

function confirmed(names) {
  return names.map((name) => ({ id: name, name, hero: "farmer", connected: true }))
}

test("a blank roster still counts seats the server confirmed", () => {
  const roster = ""
  assert.equal(
    NAMES.every((name) => roster.includes(name)),
    false
  )
  assert.equal(rosterReady(confirmed(NAMES), NAMES), true)
  assert.equal(rosterReady(confirmed(["Nia", "Ada", "Lux", "Bram"]), NAMES), false)
  const dropped = confirmed(NAMES).map((seat) => (seat.name === "Pip" ? { ...seat, connected: false } : seat))
  assert.equal(rosterReady(dropped, NAMES), false)
  assert.equal(rosterReady(null, NAMES), false)
  assert.equal(rosterReady(confirmed(NAMES), null), false)
})

test("four seats join together instead of summing past the phone limit", async () => {
  const party = [
    ["Ada", "warrior"],
    ["Lux", "mage"],
    ["Bram", "engineer"],
    ["Pip", "scout"]
  ]
  const loadMs = 40_000
  assert.ok(party.length * loadMs > 150_000)
  let inFlight = 0
  let maxInFlight = 0
  const started = []
  const delay = 40
  const start = ([name, hero]) => {
    started.push(name)
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    return new Promise((resolve) => {
      setTimeout(() => {
        inFlight -= 1
        resolve({ name, hero, connected: true })
      }, delay)
    })
  }
  const began = Date.now()
  const seats = await joinTogether(start, party)
  const elapsed = Date.now() - began
  assert.equal(maxInFlight, party.length)
  assert.deepEqual(
    started,
    party.map(([name]) => name)
  )
  assert.deepEqual(
    seats.map((seat) => seat.name),
    party.map(([name]) => name)
  )
  assert.ok(elapsed < delay * 2)
  assert.ok(elapsed < 150_000)
  assert.equal(rosterReady([{ name: "Nia", connected: true }, ...seats], NAMES), true)
})
