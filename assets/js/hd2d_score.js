import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { writeRgbaPng } from "./hd2d/png.js"
import { scoreChecks, stillRects } from "./hd2d/score.js"

export { clockScore, lumaOf, scoreChecks, ssim, stillRects } from "./hd2d/score.js"

function frameFile(dir, name, frame) {
  fs.writeFileSync(path.join(dir, `${name}.png`), writeRgbaPng(frame.rgba, frame.width, frame.height))
}

export function recordBaseline({ root, driver, frameMs, frames, rects }) {
  const label = String(driver || "")
  if (!label.includes("SwiftShader")) {
    console.log(frameMs)
    throw new Error("swiftshader")
  }
  const dest = path.join(root, "docs/concepts/HD2D-BASELINE.json")
  if (fs.existsSync(dest)) return { wrote: false }
  const checks = scoreChecks(frames, rects || stillRects(frames.day.width, frames.day.height))
  const body = {
    checks,
    times: {
      swiftshader: frameMs,
      iphone13: null,
      day: frames.day.frameMs ?? null,
      dusk: frames.dusk.frameMs ?? null,
      night: frames.night.frameMs ?? null
    },
    driver: label
  }
  const dir = path.join(root, "docs/concepts/hd2d")
  fs.mkdirSync(dir, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hd2d-baseline-"))
  try {
    frameFile(tmp, "day", frames.day)
    frameFile(tmp, "dusk", frames.dusk)
    frameFile(tmp, "night", frames.night)
    fs.renameSync(path.join(tmp, "day.png"), path.join(dir, "day.png"))
    fs.renameSync(path.join(tmp, "dusk.png"), path.join(dir, "dusk.png"))
    fs.renameSync(path.join(tmp, "night.png"), path.join(dir, "night.png"))
    const fd = fs.openSync(dest, "wx")
    try {
      fs.writeFileSync(fd, `${JSON.stringify(body, null, 2)}\n`)
    } finally {
      fs.closeSync(fd)
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return { wrote: true, baseline: body }
}
