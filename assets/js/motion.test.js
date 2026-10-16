import assert from "node:assert/strict"
import test from "node:test"
import { lerp, poseAt } from "./motion.js"

test("movement blends toward the latest server position", () => {
  assert.equal(lerp(0, 10, 0), 0)
  assert.equal(lerp(0, 10, 0.5), 5)
  assert.equal(lerp(0, 10, 1), 10)
  assert.equal(lerp(0, 10, 2), 10)
})

test("a position update is interpolated and does not jump", () => {
  const track = { fromX: 0, fromZ: 0, toX: 80, toZ: 40, at: 1000 }
  const samples = []
  for (let ms = 0; ms <= 45; ms += 5) samples.push(poseAt(track, 1000 + ms))
  assert.deepEqual(samples[0], { x: 0, z: 0 })
  assert.deepEqual(samples[samples.length - 1], { x: 80, z: 40 })
  assert.ok(samples[samples.length - 2].x < 80)
  for (let i = 1; i < samples.length; i += 1) {
    const step = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z)
    assert.ok(step > 0)
    assert.ok(step < 12)
  }
})
