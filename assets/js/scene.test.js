import assert from "node:assert/strict"
import test from "node:test"
import {
  cycleLight,
  duskFrame,
  flameColor,
  groundColor,
  hueGap,
  hueOf,
  lightLevel,
  lightName,
  litGround,
  litPool,
  litYard,
  mossColor,
  patchStats,
  plazaSides,
  skyColor,
  yardLight
} from "./scene.js"

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

test("the day field is moss and dusk is a cool field with a warm pool", () => {
  const day = litYard(groundColor, cycleLight.day)
  const moss = hueOf((mossColor >> 16) & 255, (mossColor >> 8) & 255, mossColor & 255)
  assert.ok(day.luma >= 100, `day luma ${day.luma}`)
  assert.ok(day.hue >= 85 && day.hue <= 100, `day hue ${day.hue}`)
  assert.ok(hueGap(day.hue, moss) <= 8, `day hue ${day.hue} moss ${moss}`)
  const olive = litYard(0x374115, cycleLight.day)
  assert.ok(olive.luma < 90, `olive luma ${olive.luma}`)
  const round7 = patchStats(flatPatch(51, 54, 21))
  assert.ok(round7.luma < 100 && round7.hue < 70, `round 7 day ${round7.luma} ${round7.hue}`)
  const round7Dusk = patchStats(flatPatch(44, 30, 6))
  assert.ok(round7Dusk.luma < 72, `round 7 dusk ${round7Dusk.luma}`)
  const dusk = litYard(groundColor, cycleLight.dusk)
  const flame = hueOf((flameColor >> 16) & 255, (flameColor >> 8) & 255, flameColor & 255)
  assert.ok(dusk.luma >= 72, `dusk luma ${dusk.luma}`)
  assert.ok(hueGap(dusk.hue, flame) >= 80, `dusk hue ${dusk.hue} is near the flame`)
  assert.ok(day.luma > dusk.luma, `day ${day.luma} dusk ${dusk.luma}`)
  const night = litYard(groundColor, cycleLight.night)
  assert.ok(night.luma < dusk.luma, `night ${night.luma} dusk ${dusk.luma}`)
  const pool = litPool(groundColor, cycleLight.dusk, 4)
  assert.ok(hueGap(pool.hue, flame) + 25 < hueGap(dusk.hue, flame), `pool ${pool.hue} field ${dusk.hue}`)
  const frame = duskFrame(groundColor)
  assert.ok(frame.max >= 160, `torch ${frame.max}`)
  assert.equal(frame.hue, dusk.hue)
  assert.equal(cycleLight.dusk.background, skyColor)
  assert.ok(cycleLight.dusk.torch >= 24)
  assert.ok(cycleLight.night.torch > cycleLight.dusk.torch)
  assert.ok(cycleLight.dusk.pool >= 4000)
  assert.ok(cycleLight.night.pool > cycleLight.dusk.pool)
  assert.ok(plazaSides >= 24)
  assert.equal(litGround(0xd8cfc3, cycleLight.day).g, litGround(0xd8cfc3, yardLight).g)
})
