import assert from "node:assert/strict"
import test from "node:test"
import { checkModels } from "./run.js"
import { conceptProblems, coverageProblems, fitSlack, iouLimit, paletteProblems, rulesFrom } from "./registry.js"
import { maskIou } from "./raster.js"

test("the gallery matches the goldens and a second run", () => {
  const result = checkModels({ writeGolden: false })
  assert.deepEqual(result.problems, [])
  assert.equal(result.present["lk_heroes.jpg"], false)
  assert.equal(result.present["lk_theme.jpg"], false)
  assert.equal(result.present["lk_monsters.jpg"], false)
  assert.equal(fitSlack, 2)
  assert.equal(iouLimit, 0.85)
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
