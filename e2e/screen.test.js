const assert = require("node:assert/strict")
const { test } = require("node:test")
const { CAMERA_DISTANCE, FOV_DEG, HALF_H, cardSpan, hd2dCamera, projectBox } = require("./screen")
const { iphone13FrameMs, retiredWindowMs, runnerBaselineMs, runnerCapMs, runnerMargin } = require("./perf_budget")

test("the camera span is halfH over tan of half the fov", () => {
  assert.equal(FOV_DEG, 15)
  assert.equal(HALF_H, 168)
  assert.equal(CAMERA_DISTANCE, 150)
  const camera = hd2dCamera()
  const span = HALF_H / Math.tan(((FOV_DEG * Math.PI) / 180) / 2)
  assert.ok(Math.abs(camera.span - span) < 1e-9)
  assert.ok(camera.eye.y > camera.look.y)
})

test("a hero card's screen span grows with its world height", () => {
  const low = cardSpan(120, 0, 28, 15.4, 800)
  const body = cardSpan(120, 0, 32, 15.4, 800)
  const high = cardSpan(120, 0, 36, 15.4, 800)
  assert.ok(body.min > low.min)
  assert.ok(body.max < high.max)
  // Host ring, buffer 800, width 15.4. The face-on and edge-on yaws agree
  // here because the card is thin beside the camera span. A wide card does
  // not. Locked so a refactor that returns a constant fails.
  assert.ok(Math.abs(low.min - 76.878) < 0.01)
  assert.ok(Math.abs(body.min - 85.508) < 0.01)
  assert.ok(Math.abs(body.max - body.min) < 0.01)
  assert.ok(Math.abs(high.max - 94.162) < 0.01)
  const wide = cardSpan(120, 0, 32, 80, 800)
  assert.ok(wide.min > body.max + 20)
})

test("the keep box projects several times a hero", () => {
  const hero = cardSpan(120, 0, 32, 15.4, 800)
  const keep = projectBox(
    { min: { x: -36, y: 0, z: -36 }, max: { x: 36, y: 160, z: 36 } },
    800
  )
  assert.ok(keep > hero.max * 3)
  assert.ok(Math.abs(keep - 434.29) < 0.05)
})

test("the runner cap sits between the phone frame and the retired window", () => {
  assert.equal(runnerMargin, 8)
  assert.equal(runnerBaselineMs, 6.6)
  assert.ok(Math.abs(iphone13FrameMs - 1000 / 30) < 1e-9)
  const cap = runnerCapMs()
  assert.ok(Math.abs(cap - 52.8) < 1e-9)
  assert.ok(cap > iphone13FrameMs)
  assert.ok(cap < retiredWindowMs)
})
