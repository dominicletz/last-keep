const assert = require("node:assert/strict")
const { test } = require("node:test")
const {
  CAMERA_DISTANCE,
  FOV_DEG,
  HALF_H,
  SHEET_HERO,
  SPRITE_HEIGHT,
  cardSpan,
  hd2dCamera,
  projectBox,
  sheetHeroHeight
} = require("./screen")
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

test("a sheet hero's height is 88 texels snapped to whole screen pixels", () => {
  assert.equal(SHEET_HERO, 88)
  assert.equal(SPRITE_HEIGHT, 32)
  const camera = hd2dCamera()
  const dir = {
    x: camera.look.x - camera.eye.x,
    y: camera.look.y - camera.eye.y,
    z: camera.look.z - camera.eye.z
  }
  const length = Math.hypot(dir.x, dir.y, dir.z)
  for (const [x, z] of [[120, 0], [-70.56, 96.6], [-36.96, -114.24]]) {
    const height = sheetHeroHeight(x, z, 800)
    const depth = ((x - camera.eye.x) * dir.x + (0 - camera.eye.y) * dir.y + (z - camera.eye.z) * dir.z) / length
    const worldPerPixel = (2 * depth * Math.tan(camera.fov / 2)) / 800
    const pixels = height / SHEET_HERO / worldPerPixel
    assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${pixels} px per texel`)
    assert.ok(Math.round(pixels) >= 1)
    // The snap moves the texel by at most half a pixel.
    assert.ok(Math.abs(height / SHEET_HERO - SPRITE_HEIGHT / SHEET_HERO) <= worldPerPixel / 2 + 1e-9)
  }
  // Host ring, buffer 800: one pixel per texel, 88 px, about 15% over 32.
  // Locked so a refactor that returns SPRITE_HEIGHT fails.
  assert.ok(Math.abs(sheetHeroHeight(120, 0, 800) - 36.746) < 0.01)
  // Twice the buffer is two pixels per texel at the same world height.
  assert.ok(Math.abs(sheetHeroHeight(120, 0, 1600) - sheetHeroHeight(120, 0, 800)) < 1e-9)
  // Under half a pixel per texel the card keeps its nominal height.
  assert.equal(sheetHeroHeight(120, 0, 200), SPRITE_HEIGHT)
  // The snapped card spans more pixels than the 32-unit body at the same spot.
  assert.ok(cardSpan(120, 0, sheetHeroHeight(120, 0, 800), 15.4, 800).min > cardSpan(120, 0, 32, 15.4, 800).max + 8)
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
