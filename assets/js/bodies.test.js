import assert from "node:assert/strict"
import test from "node:test"
import { monsterSpread, spreadGap } from "./bodies.js"

test("two monsters step far enough apart to read as two bodies", () => {
  assert.ok(spreadGap(1, 2) >= 16)
  assert.ok(spreadGap(2, 3) >= 16)
  assert.ok(spreadGap(8, 9) >= 16)
  assert.deepEqual(monsterSpread(4), monsterSpread(4))
  const left = monsterSpread(1)
  const right = monsterSpread(2)
  assert.ok(left.x !== right.x || left.z !== right.z)
  assert.ok(left.bar !== right.bar)
})
