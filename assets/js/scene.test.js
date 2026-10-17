import assert from "node:assert/strict"
import test from "node:test"
import { cycleLight, duskFrame, groundColor, horizonColor, lightLevel, lightName, litGround, yardLight } from "./scene.js"

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
  assert.ok(day.luma >= 90, `day luma ${day.luma}`)
  assert.ok(day.hue > 55 && day.hue < 95, `day hue ${day.hue}`)
  const olive = litGround(0x374115, cycleLight.day)
  assert.ok(olive.luma < 90, `olive luma ${olive.luma}`)
  const dusk = litGround(groundColor, cycleLight.dusk)
  assert.ok(dusk.luma >= 50, `dusk luma ${dusk.luma}`)
  assert.ok(dusk.hue <= 55, `dusk hue ${dusk.hue}`)
  const frame = duskFrame(groundColor)
  assert.ok(frame.max >= 160, `torch ${frame.max}`)
  assert.equal(cycleLight.dusk.background, horizonColor)
  assert.ok(cycleLight.dusk.torch >= 24)
  assert.ok(cycleLight.night.torch > cycleLight.dusk.torch)
})
