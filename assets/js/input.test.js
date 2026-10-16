import assert from "node:assert/strict"
import test from "node:test"
import { axes, seatFromQuery } from "./input.js"

test("an invite with a name and hero is a seat", () => {
  assert.deepEqual(seatFromQuery("?name=LLL&hero=warrior"), { name: "LLL", hero: "warrior" })
})

test("a bare invite is not a seat", () => {
  assert.equal(seatFromQuery(""), null)
  assert.equal(seatFromQuery("?name=LLL"), null)
  assert.equal(seatFromQuery("?hero=warrior"), null)
  assert.equal(seatFromQuery("?name=LLL&hero=dragon"), null)
})

test("the seat name is trimmed to 16 characters", () => {
  const seat = seatFromQuery("?name=ABCDEFGHIJKLMNOPQRSTUVWXYZ&hero=mage")
  assert.equal(seat.name, "ABCDEFGHIJKLMNOP")
  assert.equal(seat.hero, "mage")
})

test("W moves toward the top of the isometric view", () => {
  const move = axes(new Set(["KeyW"]))
  assert.ok(move.x < 0)
  assert.ok(move.y < 0)
  assert.ok(Math.abs(move.x - move.y) < 1e-9)
})

test("held diagonals stay unit length", () => {
  const move = axes(new Set(["KeyW", "KeyD"]))
  assert.ok(Math.abs(Math.hypot(move.x, move.y) - 1) < 1e-9)
})
