import assert from "node:assert/strict"
import test from "node:test"
import { lerp, maxTurn, nextTrack, poseAt, stepYaw, wrapAngle } from "./motion.js"

test("movement blends toward the latest server position", () => {
  assert.equal(lerp(0, 10, 0), 0)
  assert.equal(lerp(0, 10, 0.5), 5)
  assert.equal(lerp(0, 10, 1), 10)
  assert.equal(lerp(0, 10, 2), 10)
})

test("a position update is interpolated and does not jump", () => {
  const track = { fromX: 0, fromZ: 0, toX: 80, toZ: 40, at: 1000 }
  const samples = []
  for (let ms = 0; ms <= 50; ms += 5) samples.push(poseAt(track, 1000 + ms))
  assert.deepEqual(samples[0], { x: 0, z: 0 })
  assert.deepEqual(samples[samples.length - 1], { x: 80, z: 40 })
  assert.ok(samples[samples.length - 2].x < 80)
  for (let i = 1; i < samples.length; i += 1) {
    const step = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z)
    assert.ok(step > 0)
    assert.ok(step < 12)
  }
})

test("heroes and monsters share one yaw step, and a half turn takes at least five", () => {
  let yaw = 0
  const target = Math.PI
  const steps = []
  for (let i = 0; i < 12; i += 1) {
    const next = stepYaw(yaw, target)
    steps.push(next.step)
    yaw = next.yaw
    if (next.done) break
  }
  assert.equal(maxTurn, 0.7)
  assert.ok(steps.length >= 5)
  assert.ok(steps.every((step) => Math.abs(step) <= 0.7))
  assert.ok(Math.abs(wrapAngle(target - yaw)) < 1e-6)
  const exact = stepYaw(0, maxTurn)
  assert.equal(exact.done, true)
  assert.ok(Math.abs(exact.step - maxTurn) < 1e-9)
  const across = stepYaw(3, -3)
  assert.ok(across.step > 0)
  assert.ok(across.step <= maxTurn)
})

test("a second snapshot at the same point does not restart the blend", () => {
  const first = nextTrack(null, 0, 0, 1000)
  const moved = nextTrack(first, 10, 0, 1100)
  const again = nextTrack(moved, 10, 0, 1120)
  assert.equal(again, moved)
  assert.ok(poseAt(again, 1122).x < 10)
})
