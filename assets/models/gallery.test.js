import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { checkModels, repoRoot } from "./run.js"
import { conceptProblems, coverageProblems, fitSlack, iouLimit, paletteProblems, rulesFrom, uncitedPaletteProblems } from "./registry.js"
import { maskIou } from "./raster.js"
import { citationProblems, loadSheet, medianHex } from "./sheets.js"

test("the gallery matches the goldens and a second run", () => {
  const result = checkModels({ writeGolden: false })
  assert.deepEqual(result.problems, [])
  assert.equal(result.present["heroes.jpg"], true)
  assert.equal(result.present["theme.jpg"], true)
  assert.equal(result.present["monsters.jpg"], true)
  assert.equal(fitSlack, 2)
  assert.equal(iouLimit, 0.85)
})

test("a palette token matches the jpeg median of its cited patch", () => {
  const heroes = loadSheet(path.join(repoRoot(), "docs/concept/heroes.jpg"))
  assert.equal(medianHex(heroes, { x: 238, y: 264, w: 8, h: 8 }), "d8cfc3")
  const wrong = citationProblems(
    [{ name: "steel", hex: "000000", sheet: "heroes.jpg", region: { x: 238, y: 264, w: 8, h: 8 } }],
    { "heroes.jpg": heroes }
  )
  assert.equal(wrong.length, 1)
  const outside = citationProblems(
    [{ name: "steel", hex: "d8cfc3", sheet: "heroes.jpg", region: { x: 2000, y: 0, w: 8, h: 8 } }],
    { "heroes.jpg": heroes }
  )
  assert.equal(outside.length, 1)
  assert.equal(uncitedPaletteProblems("| boot | #3a342c | boots |\n").length, 1)
  assert.equal(uncitedPaletteProblems("| steel | #d8cfc3 | heroes.jpg | 238,264,8,8 | blades |\n").length, 0)
})

test("a kind with no model, a loose color, and a foreign sheet fail", () => {
  const rules = rulesFrom("@heroes [:warrior]\n@builds [:wall]\ndef monster(:goblin)\n")
  const missing = coverageProblems(
    [
      { id: "warrior", family: "hero" },
      { id: "wall", family: "building" },
      { id: "dragon", family: "monster" }
    ],
    rules
  )
  assert.ok(missing.some((line) => line.includes("goblin")))
  assert.ok(missing.some((line) => line.includes("dragon")))
  const colors = paletteProblems([{ id: "wall", parts: [{ name: "brick", color: 0x010203 }] }], new Map([["ffffff", "ink"]]))
  assert.equal(colors.length, 1)
  const sheets = conceptProblems([{ id: "wall", concept: { sheet: "lk_other.jpg", figure: "wall" } }])
  assert.equal(sheets.length, 1)
  const mask = new Uint8Array([1, 1, 0, 0])
  assert.equal(maskIou(mask, mask), 1)
  assert.ok(maskIou(mask, new Uint8Array([0, 0, 1, 1])) < 0.85)
})
