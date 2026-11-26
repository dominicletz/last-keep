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

test("a snapshot arriving mid-blend re-anchors at the current interpolated pose without a jump", () => {
  const first = nextTrack(null, 0, 0, 1000)
  const moving = nextTrack(first, 8, 0, 1000)
  const midBefore = poseAt(moving, 1025)
  assert.deepEqual(midBefore, { x: 4, z: 0 })
  const reanchored = nextTrack(moving, 16, 0, 1025)
  const midAfter = poseAt(reanchored, 1025)
  assert.deepEqual(midAfter, midBefore)
  assert.deepEqual(poseAt(reanchored, 1050), { x: 10, z: 0 })
  assert.deepEqual(poseAt(reanchored, 1075), { x: 16, z: 0 })
})

test("a newly spawned track with velocity interpolates across its first tick", () => {
  const shot = nextTrack(null, 120, 40, 2000, undefined, 18, -6)
  assert.deepEqual(poseAt(shot, 2000), { x: 102, z: 46 })
  assert.deepEqual(poseAt(shot, 2025), { x: 111, z: 43 })
  assert.deepEqual(poseAt(shot, 2050), { x: 120, z: 40 })
})

test("coalesced walk bursts keep the re-anchored track step below 14", () => {
  let track = nextTrack(null, 0, 0, 1000)
  track = nextTrack(track, 9, 0, 1000)
  track = nextTrack(track, 18, 0, 1005)
  const step = Math.hypot(track.toX - track.fromX, track.toZ - track.fromZ)
  assert.ok(step > 0.4)
  assert.ok(step < 14)
})
