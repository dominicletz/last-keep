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
  maskedStats,
  ownedNear,
  patchStats,
  sampleMinPixels,
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

function paint(width, height, rgbaOf) {
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = rgbaOf(x, y)
      const o = (y * width + x) * 4
      rgba[o] = pixel[0]
      rgba[o + 1] = pixel[1]
      rgba[o + 2] = pixel[2]
      rgba[o + 3] = 255
    }
  }
  return rgba
}

test("a masked sample ignores the gap and a short mask fails out loud", () => {
  assert.equal(sampleMinPixels, 24)
  const clear = [255, 0, 255]
  const pine = [53, 62, 39]
  const stone = [75, 60, 51]
  const fleck = [229, 142, 84]
  const rgba = paint(48, 48, (x, y) => {
    if (x >= 30 && x < 36 && y >= 30 && y < 36) return pine
    if (x >= 2 && x < 8 && y >= 2 && y < 8) return stone
    if (x === 24 && y === 24) return fleck
    return clear
  })
  const queryOnGap = ownedNear(rgba, 48, 48, 24, 24, clear)
  const stats = maskedStats(rgba, queryOnGap.mask, { label: "pine" })
  assert.ok(stats.count >= sampleMinPixels, `count ${stats.count}`)
  assert.ok(stats.ok)
  assert.ok(hueGap(stats.hue, hueOf(pine[0], pine[1], pine[2])) < 8, `pine hue ${stats.hue}`)
  const sat = (Math.max(stats.r, stats.g, stats.b) - Math.min(stats.r, stats.g, stats.b)) / Math.max(stats.r, 1)
  assert.ok(sat < 0.45, `fleck moved the pine ${sat}`)
  const whole = patchStats(rgba)
  assert.ok(hueGap(whole.hue, stats.hue) > 20, "the mean of the gap matched the object")
  const stoneMask = ownedNear(rgba, 48, 48, 5, 5, clear).mask
  const stoneStats = maskedStats(rgba, stoneMask, { label: "stone" })
  assert.ok(hueGap(stoneStats.hue, stats.hue) >= 25, `gap ${hueGap(stoneStats.hue, stats.hue)}`)
  const short = new Uint8Array(48 * 48)
  for (let i = 0; i < 23; i++) short[i] = 1
  assert.throws(
    () => maskedStats(rgba, short, { label: "plate" }),
    /sample short: 23 pixels of plate, need 24/
  )
})

test("the plaza is round grass with a stone curb", () => {
  assert.equal(plazaSides, 48)
  assert.ok(plazaSides >= 24)
  assert.equal(plazaColor, 0x5c642f)
  assert.equal(plazaColor, groundColor)
  assert.equal(ringColor, 0x4b3c33)
})
