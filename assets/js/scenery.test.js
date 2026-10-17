import assert from "node:assert/strict"
import test from "node:test"
import { sceneryForest } from "./scenery.js"

test("the outer ring is bare trunks with no wood", () => {
  const look = sceneryForest()
  assert.deepEqual(look.parts, ["trunk"])
  assert.equal(look.wood, 0)
  assert.equal(look.parts.includes("crown"), false)
  assert.ok(look.count > 0)
})
