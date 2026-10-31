import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { tierExtras, tierFor } from "./tier.js"

test("a tier is chosen from the device and never from a query", () => {
  assert.equal(tierFor(undefined), "high")
  assert.equal(tierFor({ hardwareConcurrency: 8, width: 1280, height: 800 }), "high")
  assert.equal(
    tierFor({ maxTouchPoints: 2, coarse: true, width: 844, height: 390, hardwareConcurrency: 6, deviceMemory: 4 }),
    "phone"
  )
  assert.equal(tierFor({ hardwareConcurrency: 8, saveData: true, width: 1280, height: 800 }), "low")
  assert.equal(tierFor({ hardwareConcurrency: 2, width: 1920, height: 1080 }), "low")
  assert.equal(tierFor({ deviceMemory: 2, width: 1280, height: 800 }), "low")
  assert.deepEqual(tierExtras("phone"), { shadow: 256, bloom: true, dof: false })
  assert.equal(tierExtras("high").dof, true)
  const source = fs.readFileSync(new URL("./tier.js", import.meta.url), "utf8")
  assert.equal(source.includes("hd2d"), false)
  assert.equal(source.includes("perf"), false)
})

test("the live page is one picture and the palette pass is gone", () => {
  const picture = fs.readFileSync(new URL("./picture.js", import.meta.url), "utf8")
  const render = fs.readFileSync(new URL("../render.js", import.meta.url), "utf8")
  const play = fs.readFileSync(new URL("../play.js", import.meta.url), "utf8")
  assert.equal(picture.includes("pictureFromSearch"), false)
  assert.match(picture, /export function createPicture/)
  assert.equal(render.includes("OrthographicCamera"), false)
  assert.equal(render.includes("createPalettePass"), false)
  assert.equal(render.includes("sat < 0.2"), false)
  assert.match(render, /clockScore\(/)
  assert.match(play, /createPicture\(deviceEnv\(\)\)/)
  assert.equal(fs.existsSync(new URL("../palette_pass.js", import.meta.url)), false)
})
