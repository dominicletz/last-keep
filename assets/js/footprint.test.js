import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { footprintGap, footprintScore, footprintTable } from "./footprint.js"
import { FOOT_TEXEL, measureAxes, measureCell, projectPixel } from "./footprint_measure.js"
import { SHEET_TEXEL } from "./hd2d/picture.js"
import { readRgbaPng } from "./hd2d/png.js"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const sheets = path.join(root, "priv/static/images/hd2d")

const cells = {
  keep: { file: "keep-sheet.png", cell: 648, mode: "sprite" },
  house: { file: "house-sheet.png", cell: 176, mode: "sprite" },
  wall: { file: "wall-sheet.png", cell: 128, mode: "sprite" },
  stone_wall: { file: "stone_wall-sheet.png", cell: 144, mode: "sprite" },
  tower: { file: "tower-sheet.png", cell: 112, mode: "sprite" },
  forge: { file: "forge-sheet.png", cell: 152, mode: "sprite" },
  mage_tower: { file: "mage_tower-sheet.png", cell: 96, mode: "sprite" },
  quarry: { file: "quarry-sheet.png", cell: 176, mode: "sprite" },
  camp: { file: "camp-sheet.png", cell: 160, mode: "sprite" },
  shrine: { file: "shrine-sheet.png", cell: 96, mode: "sprite" },
  hell_door: { file: "hell_door-sheet.png", cell: 144, mode: "plane" }
}

const table = footprintTable()

test("the footprint file uses the live sheet texel and the rank-0 camera", () => {
  assert.equal(FOOT_TEXEL, SHEET_TEXEL)
  const axes = measureAxes()
  for (const key of ["ux", "uy", "vx", "vy"]) assert.equal(table.axes[key], axes[key])
})

test("every blocking sheet's painted base sits on its footprint", () => {
  for (const [name, variants] of Object.entries(table.kinds)) {
    const meta = cells[name]
    assert.ok(meta, name)
    const image = readRgbaPng(fs.readFileSync(path.join(sheets, meta.file)))
    Object.keys(variants).forEach((id, index) => {
      const measured = measureCell(image.rgba, image.width, image.height, meta.cell, index, meta.mode)
      const spec = variants[id]
      assert.ok(Math.abs(measured.hx - spec.hx) <= 0.02, `${name} ${id} hx`)
      assert.ok(Math.abs(measured.hy - spec.hy) <= 0.02, `${name} ${id} hy`)
      assert.ok(Math.abs(measured.anchor[0] - spec.anchor[0]) <= 0.02, `${name} ${id} anchor x`)
      assert.ok(Math.abs(measured.anchor[1] - spec.anchor[1]) <= 0.02, `${name} ${id} anchor y`)
      assert.equal(measured.poly.length, spec.poly.length, `${name} ${id} poly`)
      for (let i = 0; i < spec.poly.length; i++) {
        assert.ok(Math.abs(measured.poly[i][0] - spec.poly[i][0]) <= 0.02, `${name} ${id} poly u`)
        assert.ok(Math.abs(measured.poly[i][1] - spec.poly[i][1]) <= 0.02, `${name} ${id} poly v`)
      }
      coverBase(image, meta, name, id, index, spec, measured)
    })
  }
})

function coverBase(image, meta, name, id, index, spec, measured) {
  const x0 = index * meta.cell
  let worst = 0
  let where = ""
  for (let y = measured.baseRow; y <= measured.footRow; y += 2) {
    for (let x = 0; x < meta.cell; x += 2) {
      if (image.rgba[(y * image.width + x0 + x) * 4 + 3] === 0) continue
      const point = projectPixel(meta.cell, image.height, x, y, meta.mode)
      const gap = footprintGap(name === "hell_door" ? "portal" : name, id, point.x - spec.anchor[0], point.z - spec.anchor[1])
      if (gap > worst) {
        worst = gap
        where = `${x},${y}`
      }
    }
  }
  assert.ok(worst <= 2, `${name} ${id} base sticks out by ${worst.toFixed(2)} at ${where}`)
}

test("the keep floor center is the measured base, not the front tip", () => {
  const near = Math.hypot(...table.kinds.keep["0"].anchor)
  const far = Math.hypot(...table.kinds.keep["4"].anchor)
  assert.ok(near > 100 && near < 110, near)
  assert.ok(far > 110 && far < 120, far)
  assert.ok(near > 54)
})

test("the client gap matches the probes in the shared footprint file", () => {
  assert.ok(table.probes.length > 0)
  for (const probe of table.probes) {
    const gap = footprintGap(probe.kind, probe.variant, probe.x, probe.y)
    const score = footprintScore(probe.kind, probe.variant, probe.x, probe.y)
    assert.ok(Math.abs(gap - probe.gap) < 0.001, `${probe.kind} gap ${gap} vs ${probe.gap}`)
    assert.ok(Math.abs(score - probe.score) < 0.001, `${probe.kind} score ${score} vs ${probe.score}`)
  }
})
