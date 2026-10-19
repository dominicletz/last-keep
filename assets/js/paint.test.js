import assert from "node:assert/strict"
import test from "node:test"
import { absorbShots, bodyPixel, nextAttackPeak, seatList, swingSeen } from "./paint.js"

test("a fireball is noted before the scene is drawn", () => {
  const kinds = absorbShots(["bolt"], [{ kind: "bolt" }, { kind: "fireball" }, null, {}])
  assert.deepEqual(kinds, ["bolt", "fireball"])
  assert.deepEqual(absorbShots(kinds, [{ kind: "fireball" }]), ["bolt", "fireball"])
  assert.deepEqual(absorbShots(null, []), [])
})

test("a cooled swing still raises the attack latch", () => {
  assert.equal(swingSeen({ saw_swing: true, events: [] }), true)
  assert.equal(swingSeen({ events: [{ type: "swing" }] }), true)
  assert.equal(swingSeen({ events: [] }), false)
  assert.equal(swingSeen(null), false)
  assert.equal(nextAttackPeak(0, 0, true), 1)
  assert.equal(nextAttackPeak(0, 400, false), 400)
  assert.equal(nextAttackPeak(400, 0, false), 400)
  assert.equal(nextAttackPeak(undefined, 0, false), 0)
})

test("a seat list is the server join", () => {
  assert.deepEqual(
    seatList([
      { id: "p1", name: "Nia", hero: "farmer", connected: true },
      { id: "p2", name: "Ada", hero: "warrior", connected: true },
      { id: "p3", name: "Pip", hero: "scout", connected: false }
    ]),
    [
      { id: "p1", name: "Nia", hero: "farmer", connected: true },
      { id: "p2", name: "Ada", hero: "warrior", connected: true },
      { id: "p3", name: "Pip", hero: "scout", connected: false }
    ]
  )
  assert.deepEqual(seatList(null), [])
})

test("a drawn body counts red hide and the dark rim, not lit grass", () => {
  assert.equal(bodyPixel(255, 58, 34), true)
  assert.equal(bodyPixel(20, 6, 2), true)
  assert.equal(bodyPixel(27, 9, 3), true)
  assert.equal(bodyPixel(99, 106, 30), false)
  assert.equal(bodyPixel(104, 81, 27), false)
  assert.equal(bodyPixel(77, 67, 59), false)
})
