import assert from "node:assert/strict"
import test from "node:test"
import { cycleLight, duskFrame, groundColor, horizonColor, lightLevel, lightName, litGround, patchStats, yardLight } from "./scene.js"

function flatPatch(r, g, b) {
  const rgba = new Uint8Array(8 * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  return rgba
}

test("the yard cycles from day to dusk to night, and night is the darkest", () => {
  assert.equal(lightName({ hold: true, phase: "build", phase_ms: 20000 }), "day")
  assert.equal(lightName({ hold: false, phase: "build", phase_ms: 20000 }), "day")
  assert.equal(lightName({ hold: false, phase: "build", phase_ms: 8000 }), "dusk")
  assert.equal(lightName({ hold: false, phase: "build", phase_ms: 1000 }), "dusk")
  assert.equal(lightName({ phase: "wave", phase_ms: 40000 }), "night")
  assert.equal(lightName({ phase: "over" }), "night")
  assert.equal(lightName({ phase: "build", enraged: true, phase_ms: 20000 }), "night")
  assert.ok(lightLevel("night") < lightLevel("dusk"))
  assert.ok(lightLevel("dusk") < lightLevel("day"))
  assert.equal(cycleLight.day.sun, yardLight.sun)
  assert.equal(cycleLight.day.sunLevel, yardLight.sunLevel)
})

test("the day field is lit grass and the dusk frame keeps a torch", () => {
  const day = litGround(groundColor, cycleLight.day)
  assert.ok(day.luma >= 100, `day luma ${day.luma}`)
  assert.ok(day.hue >= 70 && day.hue < 95, `day hue ${day.hue}`)
  const olive = litGround(0x374115, cycleLight.day)
  assert.ok(olive.luma < 90, `olive luma ${olive.luma}`)
  const round7 = patchStats(flatPatch(51, 54, 21))
  assert.ok(round7.luma < 100 && round7.hue < 70, `round 7 day ${round7.luma} ${round7.hue}`)
  const round7Dusk = patchStats(flatPatch(44, 30, 6))
  assert.ok(round7Dusk.luma < 72, `round 7 dusk ${round7Dusk.luma}`)
  const dusk = litGround(groundColor, cycleLight.dusk)
  assert.ok(dusk.luma >= 72, `dusk luma ${dusk.luma}`)
  assert.ok(dusk.hue <= 48 && dusk.hue >= 28, `dusk hue ${dusk.hue}`)
  assert.ok(day.luma > dusk.luma, `day ${day.luma} dusk ${dusk.luma}`)
  const night = litGround(groundColor, cycleLight.night)
  assert.ok(night.luma < dusk.luma, `night ${night.luma} dusk ${dusk.luma}`)
  const frame = duskFrame(groundColor)
  assert.ok(frame.max >= 160, `torch ${frame.max}`)
  assert.equal(cycleLight.dusk.background, horizonColor)
  assert.ok(cycleLight.dusk.torch >= 24)
  assert.ok(cycleLight.night.torch > cycleLight.dusk.torch)
})
