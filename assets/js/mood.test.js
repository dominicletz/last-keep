import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import jpeg from "jpeg-js"
import { GROUND_TEX, PLAZA_TEX, groundPixels, plazaPixels } from "./ground.js"
import { groundProblems, groundSpread, moodOf, moodProblems } from "./mood.js"

const here = path.dirname(fileURLToPath(import.meta.url))

function loadJpeg(file) {
  const decoded = jpeg.decode(fs.readFileSync(file), { useTArray: true, formatAsRGBA: true })
  return {
    mood: moodOf(decoded.data, decoded.width, decoded.height),
    ground: groundSpread(decoded.data, decoded.width, decoded.height),
    width: decoded.width,
    height: decoded.height
  }
}

function fill(r, g, b, width = 64, height = 64) {
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  return moodOf(rgba, width, height)
}

test("the concept frame passes and a flat tint fails", () => {
  const concept = loadJpeg(path.join(here, "../../docs/concept/theme.jpg"))
  assert.deepEqual(moodProblems(concept.mood, "concept"), [])
  const lime = fill(98, 136, 52)
  const lavender = fill(87, 75, 89)
  const olive = fill(48, 50, 23)
  assert.ok(moodProblems(lime, "day").length > 0)
  assert.ok(moodProblems(lavender, "dusk").length > 0)
  assert.ok(moodProblems(olive, "night").length > 0)
})

test("the 2026-10-18 live frames fail the same comparison", () => {
  const day = loadJpeg(path.join(here, "fixtures/live-day.jpg"))
  const dusk = loadJpeg(path.join(here, "fixtures/live-dusk.jpg"))
  const night = loadJpeg(path.join(here, "fixtures/live-night.jpg"))
  const dayProblems = moodProblems(day.mood, "day")
  const duskProblems = moodProblems(dusk.mood, "dusk")
  const nightProblems = moodProblems(night.mood, "night")
  assert.ok(dayProblems.some((line) => line.includes("lime") || line.includes("flat")), dayProblems.join("; "))
  assert.ok(duskProblems.some((line) => line.includes("cool") || line.includes("flat")), duskProblems.join("; "))
  assert.ok(nightProblems.some((line) => line.includes("flat")), nightProblems.join("; "))
  assert.ok(day.mood.lime > dusk.mood.lime)
})

test("the concept ground is worn and today's yard frames are a flat wash", () => {
  const concept = loadJpeg(path.join(here, "../../docs/concept/theme.jpg"))
  assert.deepEqual(groundProblems(concept.ground), [], JSON.stringify(concept.ground))
  for (const phase of ["day", "dusk", "night"]) {
    const live = loadJpeg(path.join(here, `fixtures/yard-${phase}.jpg`))
    const problems = groundProblems(live.ground)
    assert.ok(problems.length > 0, `${phase} spread ${live.ground.spread}`)
  }
})

test("the painted yard keeps texture, a moss day, and a warm dusk edge", () => {
  for (const phase of ["day", "dusk", "night"]) {
    const pixels = groundPixels(phase)
    const problems = moodProblems(moodOf(pixels, GROUND_TEX, GROUND_TEX), phase)
    assert.deepEqual(problems, [], `${phase} ${problems.join("; ")}`)
    const plaza = plazaPixels(phase)
    const wash = groundProblems(groundSpread(plaza, PLAZA_TEX, PLAZA_TEX))
    assert.deepEqual(wash, [], `${phase} plaza ${wash.join("; ")}`)
  }
})
