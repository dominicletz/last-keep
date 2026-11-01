import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { bakeTiles, citedHexes, lockedColors, phaseScales, tileModule } from "../models/tiles.js"
import { figureAlpha, propBytes } from "./tiles.js"
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
  assert.equal(phaseTiles.day.forge.w, 200)
  assert.equal(phaseTiles.day.forge.h, 150)
  assert.equal(phaseTiles.day.trap.w, 100)
  assert.equal(phaseTiles.day.trap.h, 90)
  assert.equal(phaseTiles.day.tower.w, 120)
  assert.equal(phaseTiles.day.tower.h, 130)
  assert.equal(phaseTiles.day.mage_tower.w, 160)
  assert.equal(phaseTiles.day.keep.w, 188)
  assert.equal(phaseTiles.day.tree.w, 96)
  assert.equal(phaseTiles.day.tree.h, 112)
  assert.equal(phaseTiles.day.scenery.w, 48)
  assert.equal(phaseTiles.day.scenery.h, 80)
  const page = fs.readFileSync(path.join(root, "assets/js/yard_cards.js"), "utf8")
  const view = fs.readFileSync(path.join(root, "assets/js/render.js"), "utf8")
  assert.match(view, /const sheetKinds = yardCards/)
  assert.match(page, /forge: \{ w: 48, h: 36, stand: true \}/)
  assert.match(page, /trap: \{ w: 22, h: 20, stand: true \}/)
  assert.match(page, /tower: \{ w: 28, h: 48, stand: true \}/)
  assert.match(page, /mage_tower: \{ w: 26, h: 36, stand: true \}/)
  assert.match(page, /tree: \{ w: 48, h: 40, stand: true, cut: true \}/)
  assert.match(page, /scenery: \{ w: 18, h: 30, stand: true, cut: true \}/)
  for (const name of ["tree", "scenery"]) {
    const tile = propBytes(name, "day")
    let ink = 0
    for (let i = 3; i < tile.rgba.length; i += 4) if (tile.rgba[i] === 255) ink += 1
    const share = ink / (tile.w * tile.h)
    assert.ok(share > 0.2 && share < 0.55, `${name} cut share ${share}`)
    assert.equal(figureAlpha(name, 0, 0, tile.w, tile.h), 0)
    assert.equal(tile.rgba[(Math.floor(tile.h * 0.45) * tile.w + Math.floor(tile.w * 0.5)) * 4 + 3], 255)
  }
  const duskTree = propBytes("tree", "dusk")
  assert.ok(inkMedian(duskTree) >= 36, inkMedian(duskTree))
})

function inkMedian(tile) {
  const lumas = []
  for (let i = 0; i < tile.w * tile.h; i++) {
    if (tile.rgba[i * 4 + 3] === 0) continue
    const o = i * 4
    lumas.push(0.2126 * tile.rgba[o] + 0.7152 * tile.rgba[o + 1] + 0.0722 * tile.rgba[o + 2])
  }
  lumas.sort((a, b) => a - b)
  return lumas[lumas.length >> 1]
}
