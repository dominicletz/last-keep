import assert from "node:assert/strict"
import test from "node:test"
import { bodyPixel } from "./paint.js"

test("a drawn body counts red hide and the dark rim, not lit grass", () => {
  assert.equal(bodyPixel(255, 58, 34), true)
  assert.equal(bodyPixel(20, 6, 2), true)
  assert.equal(bodyPixel(27, 9, 3), true)
  assert.equal(bodyPixel(99, 106, 30), false)
  assert.equal(bodyPixel(104, 81, 27), false)
  assert.equal(bodyPixel(77, 67, 59), false)
})
