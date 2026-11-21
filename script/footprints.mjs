// Writes priv/footprints.json. Rerun after a blocking sheet changes.
// node script/footprints.mjs
//
// The measure lives in assets/js/footprint_measure.js. Docs:
// docs/concepts/ART-PIPELINE.md, section Footprints.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { measureAxes, measureCell } from "../assets/js/footprint_measure.js"
import { readRgbaPng } from "../assets/js/hd2d/png.js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const outPath = path.join(root, "priv/footprints.json")

const sheets = [
  ["keep", "keep-sheet.png", 648, ["0", "1", "2", "3", "4"], "sprite"],
  ["house", "house-sheet.png", 176, ["a"], "sprite"],
  ["wall", "wall-sheet.png", 128, ["a"], "sprite"],
  ["stone_wall", "stone_wall-sheet.png", 144, ["a"], "sprite"],
  ["tower", "tower-sheet.png", 112, ["a"], "sprite"],
  ["forge", "forge-sheet.png", 152, ["a"], "sprite"],
  ["mage_tower", "mage_tower-sheet.png", 96, ["a"], "sprite"],
  ["quarry", "quarry-sheet.png", 176, ["a", "b"], "sprite"],
  ["camp", "camp-sheet.png", 160, ["a"], "sprite"],
  ["shrine", "shrine-sheet.png", 96, ["a"], "sprite"],
  ["hell_door", "hell_door-sheet.png", 144, ["a"], "plane"]
]

const kinds = {}
for (const [name, file, cell, variants, mode] of sheets) {
  const image = readRgbaPng(fs.readFileSync(path.join(root, "priv/static/images/hd2d", file)))
  const spec = {}
  variants.forEach((id, index) => {
    const measured = measureCell(image.rgba, image.width, image.height, cell, index, mode)
    spec[id] = {
      hx: measured.hx,
      hy: measured.hy,
      anchor: measured.anchor,
      plane: mode === "plane" ? measured.plane : null,
      poly: measured.poly
    }
    console.log(`${name} ${id} hx ${measured.hx} hy ${measured.hy} anchor ${measured.anchor.join(",")}`)
  })
  kinds[name] = spec
}

const table = {
  axes: measureAxes(),
  block: ["keep", "wall", "stone_wall", "house", "tower", "forge", "mage_tower", "portal", "quarry", "camp", "shrine"],
  alias: { portal: "hell_door" },
  kinds,
  probes: []
}

fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + "\n")

const { footprintGap, footprintScore } = await import(`../assets/js/footprint.js?fresh=${Date.now()}`)

const probes = []
function add(kind, variant, x, y) {
  probes.push({
    kind,
    variant,
    x,
    y,
    gap: Math.round(footprintGap(kind, variant, x, y) * 1000) / 1000,
    score: Math.round(footprintScore(kind, variant, x, y) * 1000) / 1000
  })
}

add("keep", "0", 0, 0)
add("keep", "0", 200, 0)
add("keep", "0", 80, 0)
add("house", "a", 0, 0)
add("house", "a", 40, 0)
add("wall", "a", 0, 0)
add("portal", "a", 0, 0)
add("quarry", "a", 0, 0)
add("camp", "a", 30, 0)
add("shrine", "a", 0, 20)

table.probes = probes
fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + "\n")
console.log(`wrote ${outPath} (${probes.length} probes)`)
