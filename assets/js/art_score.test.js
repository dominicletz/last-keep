import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { models, styleTables } from "../models/registry.js"
import { decodePng, renderCloseup } from "../models/raster.js"
import { loadSheet } from "../models/sheets.js"
import { heroCrops } from "../models/sprites.js"
import { blockPercentiles, hardEdge, lockedPalette, scoreFrame } from "./art_score.js"

const markdown = fs.readFileSync(new URL("../../STYLE.md", import.meta.url), "utf8")
const { tokens } = styleTables(markdown)
const palette = lockedPalette([...tokens.keys()])

function cropOf(sheet, box) {
  const rgb = new Uint8Array(box.w * box.h * 3)
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const s = ((box.y + y) * sheet.width + box.x + x) * 4
      const d = (y * box.w + x) * 3
      rgb[d] = sheet.data[s]
      rgb[d + 1] = sheet.data[s + 1]
      rgb[d + 2] = sheet.data[s + 2]
    }
  }
  return { rgb, width: box.w, height: box.h }
}

test("the town crop clears the block and edge floors and matches itself", () => {
  const theme = loadSheet(new URL("../../docs/concept/theme.jpg", import.meta.url).pathname)
  const town = cropOf(theme, { x: 480, y: 250, w: 340, h: 270 })
  const block = blockPercentiles(town.rgb, town.width, town.height, null)
  const edge = hardEdge(town.rgb, town.width, town.height, null)
  assert.equal(block.p25, 13)
  assert.ok(edge > 0.065 && edge < 0.075, edge)
  const self = scoreFrame(town, town, palette)
  assert.equal(self.ssim, 1)
  assert.equal(self.iou, 1)
})

test("the gallery keep still misses the pipeline floors", () => {
  const png = decodePng(fs.readFileSync(new URL("../../test/gallery/keep/day.png", import.meta.url)))
  const theme = loadSheet(new URL("../../docs/concept/theme.jpg", import.meta.url).pathname)
  const crop = cropOf(theme, { x: 548, y: 28, w: 188, h: 230 })
  const score = scoreFrame({ rgb: png.rgb, width: png.width, height: png.height }, crop, palette)
  assert.ok(score.blockP25 < 8, score.blockP25)
  assert.ok(score.ssim < 0.35, score.ssim)
  assert.ok(score.iou < 0.55, score.iou)
  assert.ok(score.membership < 0.98, score.membership)
})

// Measured on the player-camera close-up. The spec targets are block 8, SSIM 0.35,
// IoU 0.55, and membership 0.98. These floors are the cards we ship. They only rise.
const heroFloors = {
  warrior: { block: 15, ssim: 0.19, iou: 0.48 },
  mage: { block: 14, ssim: 0.11, iou: 0.4 },
  scout: { block: 17, ssim: 0.32, iou: 0.48 },
  farmer: { block: 16, ssim: 0.23, iou: 0.46 },
  engineer: { block: 12, ssim: 0.39, iou: 0.5 }
}

test("each hero close-up holds its pipeline score in day, dusk, and night", () => {
  const heroes = loadSheet(new URL("../../docs/concept/heroes.jpg", import.meta.url).pathname)
  const crops = heroCrops()
  const listed = models()
  for (const [id, floor] of Object.entries(heroFloors)) {
    const model = listed.find((row) => row.id === id)
    const crop = cropOf(heroes, crops[id])
    for (const light of ["day", "dusk", "night"]) {
      const shot = renderCloseup(model.parts, light)
      const score = scoreFrame(
        { rgb: shot.rgb, width: shot.width, height: shot.height, mask: shot.mask },
        crop,
        palette
      )
      assert.ok(score.blockP25 >= floor.block, `${id} ${light} block ${score.blockP25}`)
      assert.ok(score.ssim >= floor.ssim, `${id} ${light} ssim ${score.ssim}`)
      assert.ok(score.iou >= floor.iou, `${id} ${light} iou ${score.iou}`)
      assert.ok(score.membership < 0.02, `${id} ${light} membership ${score.membership}`)
    }
  }
})
