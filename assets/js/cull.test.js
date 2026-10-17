import assert from "node:assert/strict"
import test from "node:test"
import { monsterVisible } from "./cull.js"

test("a monster outside the camera is not drawn", () => {
  assert.equal(monsterVisible(0, 0, 0), true)
  assert.equal(monsterVisible(0.9, -0.4, 0.2), true)
  assert.equal(monsterVisible(3.4, 0.2, 0.5), false)
  assert.equal(monsterVisible(0.2, -2.5, 0.5), false)
  assert.equal(monsterVisible(0, 0, 1.4), false)
  assert.equal(monsterVisible(0, 0, -1.2), false)
  assert.equal(monsterVisible(Number.NaN, 0, 0), false)
})
