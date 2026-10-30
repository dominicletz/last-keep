import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { recordBaseline, scoreChecks, ssim } from "./hd2d_score.js"

function solid(width, height, rgb) {
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[0]
    rgba[i * 4 + 1] = rgb[1]
    rgba[i * 4 + 2] = rgb[2]
    rgba[i * 4 + 3] = 255
  }
  return { rgba, width, height, frameMs: 4 }
}

function paint(frame, rect, rgb) {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const o = (y * frame.width + x) * 4
      frame.rgba[o] = rgb[0]
      frame.rgba[o + 1] = rgb[1]
      frame.rgba[o + 2] = rgb[2]
    }
  }
}

test("crisp, shadow, and light checks follow the buffers", () => {
  const day = solid(64, 64, [20, 20, 20])
  for (let y = 0; y < 64; y++) {
    for (let x = 40; x < 64; x++) {
      const o = (y * 64 + x) * 4
      day.rgba[o] = (x * 13) % 256
      day.rgba[o + 1] = (y * 7) % 256
      day.rgba[o + 2] = (x + y) % 256
    }
  }
  paint(day, { x: 4, y: 4, w: 16, h: 16 }, [210, 210, 210])
  paint(day, { x: 4, y: 28, w: 8, h: 8 }, [5, 5, 5])
  paint(day, { x: 12, y: 28, w: 8, h: 8 }, [180, 180, 180])
  const night = solid(64, 64, [20, 20, 20])
  paint(night, { x: 4, y: 4, w: 16, h: 16 }, [210, 210, 210])
  const dusk = solid(64, 64, [40, 30, 20])
  const rects = {
    heroes: [{ x: 4, y: 4, w: 16, h: 16 }],
    near: { x: 4, y: 48, w: 16, h: 8 },
    far: { x: 40, y: 40, w: 16, h: 16 },
    torch: { x: 4, y: 4, w: 8, h: 8 },
    flame: { x: 20, y: 20, w: 8, h: 8 },
    quads: [{ x: 4, y: 28, w: 8, h: 8 }]
  }
  const checks = scoreChecks({ day, dusk, night }, rects)
  assert.ok(checks[3].crisp > 0)
  assert.equal(checks[5].lit, 0)
  assert.ok(checks[6].shadows > 0)
  assert.equal(ssim(day, day), 1)
  const other = solid(32, 64, [1, 2, 3])
  assert.throws(() => ssim(day, other), /ssim size/)
})

test("a baseline is written once and only on SwiftShader", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hd2d-score-"))
  const dest = path.join(root, "docs/concepts/HD2D-BASELINE.json")
  const frames = {
    day: solid(16, 16, [30, 40, 50]),
    dusk: solid(16, 16, [80, 40, 20]),
    night: solid(16, 16, [8, 8, 12])
  }
  const rects = {
    heroes: [{ x: 0, y: 0, w: 8, h: 8 }],
    near: { x: 0, y: 8, w: 8, h: 8 },
    far: { x: 8, y: 0, w: 8, h: 8 },
    torch: { x: 0, y: 0, w: 8, h: 8 },
    flame: { x: 4, y: 4, w: 4, h: 4 },
    quads: [{ x: 0, y: 8, w: 4, h: 4 }]
  }
  assert.throws(() => recordBaseline({ root, driver: "WebKit WebGL", frameMs: 9, frames, rects }), /swiftshader/)
  assert.equal(fs.existsSync(dest), false)
  const first = recordBaseline({ root, driver: "ANGLE (Google, SwiftShader)", frameMs: 11.5, frames, rects })
  assert.equal(first.wrote, true)
  const saved = JSON.parse(fs.readFileSync(dest, "utf8"))
  for (const id of ["3", "4", "5", "6", "7", "8", "9", "10"]) assert.ok(saved.checks[id])
  assert.equal(saved.checks["10"].ssim, null)
  assert.equal(saved.checks["10"].reference, true)
  assert.equal(saved.times.iphone13, null)
  assert.equal(saved.times.swiftshader, 11.5)
  assert.equal(fs.existsSync(path.join(root, "docs/concepts/hd2d/day.png")), true)
  const second = recordBaseline({ root, driver: "ANGLE (Google, SwiftShader)", frameMs: 99, frames, rects })
  assert.equal(second.wrote, false)
  assert.equal(JSON.parse(fs.readFileSync(dest, "utf8")).times.swiftshader, 11.5)
})
