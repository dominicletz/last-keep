import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { bakeTiles, citedHexes, lockedColors, phaseScales, tileModule } from "../models/tiles.js"
import { loadSheet } from "../models/sheets.js"
import { phaseTiles } from "./tile-data.js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

function blockP25(bytes, width, height) {
  const counts = []
  for (let y = 0; y + 8 <= height; y += 8) {
    for (let x = 0; x + 8 <= width; x += 8) {
      const seen = new Set()
      for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          const offset = ((y + yy) * width + (x + xx)) * 3
          seen.add(`${bytes[offset] >> 4},${bytes[offset + 1] >> 4},${bytes[offset + 2] >> 4}`)
        }
      }
      counts.push(seen.size)
    }
  }
  counts.sort((a, b) => a - b)
  return counts[Math.floor(0.25 * (counts.length - 1))]
}

function hardEdge(bytes, width, height) {
  let n = 0
  let hit = 0
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x + 1 < width; x += 2) {
      const left = (y * width + x) * 3
      const right = (y * width + x + 1) * 3
      n += 1
      const jump = Math.abs(
        luma(bytes[left], bytes[left + 1], bytes[left + 2]) -
          luma(bytes[right], bytes[right + 1], bytes[right + 2])
      )
      if (jump > 28) hit += 1
    }
  }
  return n ? hit / n : 0
}

test("the concept tiles match the bake and stay on the phase palette", () => {
  const markdown = fs.readFileSync(path.join(root, "STYLE.md"), "utf8")
  const hexes = citedHexes(markdown)
  assert.equal(hexes.length, 40)
  assert.deepEqual(phaseScales, {
    day: [1, 0.6, 0.5, 0.4],
    dusk: [0.6, 0.5],
    night: [0.5, 0.4]
  })
  const sheet = loadSheet(path.join(root, "docs/concept/theme.jpg"))
  const baked = bakeTiles(sheet, hexes)
  const written = fs.readFileSync(path.join(root, "assets/js/tile-data.js"), "utf8")
  assert.equal(written, tileModule(baked))
  for (const phase of Object.keys(phaseScales)) {
    const palette = lockedColors(hexes, phaseScales[phase])
    for (const [name, tile] of Object.entries(baked[phase])) {
      const bytes = tile.rgb
      for (let i = 0; i < bytes.length; i += 3) {
        let best = Infinity
        for (const color of palette) {
          const dist =
            (bytes[i] - color[0]) ** 2 + (bytes[i + 1] - color[1]) ** 2 + (bytes[i + 2] - color[2]) ** 2
          if (dist < best) best = dist
        }
        assert.ok(Math.sqrt(best) <= 1, `${phase} ${name} pixel ${i / 3} is ${Math.sqrt(best)} from the palette`)
      }
      const block = blockP25(bytes, tile.w, tile.h)
      const edge = hardEdge(bytes, tile.w, tile.h)
      assert.ok(block >= 8, `${phase} ${name} block p25 ${block}`)
      assert.ok(edge >= 0.05, `${phase} ${name} hard edge ${edge}`)
    }
  }
  assert.equal(phaseTiles.day.grass.w, 48)
  assert.equal(phaseTiles.day.masonry.w, 48)
})
