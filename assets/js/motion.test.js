import assert from "node:assert/strict"
import test from "node:test"
import { lerp } from "./motion.js"

test("movement blends toward the latest server position", () => {
  assert.equal(lerp(0, 10, 0), 0)
  assert.equal(lerp(0, 10, 0.5), 5)
  assert.equal(lerp(0, 10, 1), 10)
  assert.equal(lerp(0, 10, 2), 10)
})
