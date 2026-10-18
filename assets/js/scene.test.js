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
  patchStats,
  plazaColor,
  plazaSides,
  ringColor,
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

function channelGap(left, right) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b)
}

test("day stays on the grass palette and dusk does not tint the materials", () => {
  const day = litGround(groundColor, cycleLight.day)
  assert.ok(day.luma >= 90 && day.luma <= 140, `day luma ${day.luma}`)
  assert.ok(day.hue < 78 || day.g <= day.r + 15, `day is lime ${day.hue}`)
  assert.equal(cycleLight.day.groundFillLevel, 0)
  assert.equal(cycleLight.dusk.groundFillLevel, 0)
  const dusk = litGround(groundColor, cycleLight.dusk)
  const night = litGround(groundColor, cycleLight.night)
  assert.ok(day.luma > dusk.luma, `day ${day.luma} dusk ${dusk.luma}`)
  assert.ok(dusk.luma > night.luma, `dusk ${dusk.luma} night ${night.luma}`)
  assert.ok(dusk.g > dusk.r && dusk.g > dusk.b, `dusk grass ${dusk.r} ${dusk.g} ${dusk.b}`)
  const stone = litGround(0x4b3c33, cycleLight.dusk)
  const plate = litGround(0xb5afaa, cycleLight.dusk)
  const wood = litGround(0x8e755b, cycleLight.dusk)
  const plateSat = (Math.max(plate.r, plate.g, plate.b) - Math.min(plate.r, plate.g, plate.b)) / plate.r
  assert.ok(plateSat < 0.12, `plate sat ${plateSat}`)
  assert.ok(channelGap(stone, plate) >= 28, "stone and plate collapsed")
  assert.ok(channelGap(stone, wood) >= 28, "stone and wood collapsed")
  assert.ok(channelGap(plate, wood) >= 28, "plate and wood collapsed")
  const flame = hueOf((flameColor >> 16) & 255, (flameColor >> 8) & 255, flameColor & 255)
  const pool = litPool(groundColor, cycleLight.dusk, 4)
  assert.ok(hueGap(pool.hue, flame) < hueGap(dusk.hue, flame), `pool ${pool.hue} field ${dusk.hue}`)
  const frame = duskFrame(groundColor)
  assert.ok(frame.max >= 160, `torch ${frame.max}`)
  assert.ok(cycleLight.night.torch > cycleLight.dusk.torch)
  assert.equal(cycleLight.dusk.background, skyColor)
  assert.ok(cycleLight.dusk.pool >= 4000)
  assert.ok(cycleLight.night.pool > cycleLight.dusk.pool)
  assert.equal(litGround(0xd8cfc3, cycleLight.day).g, litGround(0xd8cfc3, yardLight).g)
  assert.ok(patchStats(flatPatch(98, 136, 52)).hue > 80)
})

test("the plaza is round grass with a stone curb", () => {
  assert.equal(plazaSides, 48)
  assert.ok(plazaSides >= 24)
  assert.equal(plazaColor, 0x5c642f)
  assert.equal(plazaColor, groundColor)
  assert.equal(ringColor, 0x4b3c33)
})
