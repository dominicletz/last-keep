import assert from "node:assert/strict"
import test from "node:test"
import { modelParts } from "./registry.js"
import { renderParts } from "./raster.js"
import { detailFloor } from "./voxels.js"

test("the goblin spear and the skeleton bone survive at game zoom", () => {
  const goblin = renderParts(modelParts("goblin"), "day")
  const spear = sidePixels(goblin, 0x8e755b, 1)
  assert.ok(spear >= detailFloor, `spear pixels ${spear}`)
  const skeleton = renderParts(modelParts("skeleton"), "day")
  const bone = sidePixels(skeleton, 0xb2ada6, 0)
  assert.ok(bone >= detailFloor, `bone pixels ${bone}`)
})

function sidePixels(image, hex, side) {
  const [r, g, b] = bytes(hex)
  const bounds = occupied(image)
  const mid = (bounds.minX + bounds.maxX) / 2
  let count = 0
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (side > 0 && x <= mid) continue
      if (side < 0 && x >= mid) continue
      if (near(image, x, y, r, g, b)) count += 1
    }
  }
  return count
}

function occupied(image) {
  let minX = image.width
  let minY = image.height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!image.mask[y * image.width + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}

function near(image, x, y, r, g, b, slack = 70) {
  const index = y * image.width + x
  if (!image.mask[index]) return false
  const offset = index * 3
  return (
    Math.abs(image.rgb[offset] - r) <= slack &&
    Math.abs(image.rgb[offset + 1] - g) <= slack &&
    Math.abs(image.rgb[offset + 2] - b) <= slack
  )
}

function bytes(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}
