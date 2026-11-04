import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildingCard, cardFallback, treeCard, treeSheet, treeVariant, yardCards } from "./yard_cards.js"
import { readRgbaPng } from "./hd2d/png.js"
import { spriteHeight } from "./pictures.js"
import { SHEET_HERO } from "./hd2d/picture.js"
import { modelParts } from "../models/registry.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function serverBuildings() {
  const rules = fs.readFileSync(path.join(root, "lib/last_keep/game/rules.ex"), "utf8")
  return [...rules.matchAll(/def building\(:([a-z_]+)\)/g)].map((m) => m[1])
}

function drawable(kind) {
  if (buildingCard(kind)) return true
  try {
    modelParts(kind)
    return true
  } catch {
    return false
  }
}

test("every building the server can place draws a card or a model", () => {
  const kinds = serverBuildings()
  assert.ok(kinds.includes("stone_wall"), kinds.join(","))
  assert.ok(kinds.length >= 8, kinds.join(","))
  for (const kind of kinds) assert.ok(drawable(kind), `${kind} has no card and no model: buildingMesh would throw`)
})

test("stone_wall falls back to the wall card instead of throwing", () => {
  assert.throws(() => modelParts("stone_wall"), /no model for stone_wall/)
  assert.equal(buildingCard("stone_wall"), "wall")
  assert.equal(yardCards[buildingCard("stone_wall")].stand, true)
})

test("a card of its own wins and unknown kinds are not given a card", () => {
  for (const kind of Object.keys(yardCards)) assert.equal(buildingCard(kind), kind)
  assert.equal(buildingCard("no_such_building"), null)
  for (const [kind, other] of Object.entries(cardFallback)) {
    assert.equal(yardCards[kind], undefined, `${kind} has its own card: drop its fallback`)
    assert.ok(yardCards[other], `${kind} falls back to ${other}, which has no card`)
  }
})

test("buildingMesh picks its card through buildingCard", () => {
  const view = fs.readFileSync(path.join(root, "assets/js/render.js"), "utf8")
  assert.match(view, /const cardKind = buildingCard\(row\.kind\)/)
  assert.match(view, /new THREE\.Sprite\(sheetMats\[cardKind\]\)/)
  assert.doesNotMatch(view, /sheetMats\[row\.kind\]/)
})

test("trees draw the pine sheet: its cells, foot row and variant heights match the build", () => {
  const image = readRgbaPng(fs.readFileSync(path.join(root, "priv/static", treeSheet.url)))
  const [cw, ch] = treeSheet.cell
  assert.equal(image.width, cw * treeSheet.variants.length)
  assert.equal(image.height, ch)
  const heights = []
  for (let v = 0; v < treeSheet.variants.length; v++) {
    let top = -1
    let bottom = -1
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (!image.rgba[(y * image.width + v * cw + x) * 4 + 3]) continue
        if (top < 0) top = y
        bottom = y
        break
      }
    }
    assert.equal(bottom, treeSheet.footRow, `variant ${treeSheet.variants[v]} stands on the foot row`)
    heights.push(bottom - top + 1)
  }
  // a is the tree card's 40 units at the hero texel; b is drawn at 0.85.
  assert.deepEqual(heights, [110, 94])
  assert.equal(treeSheet.texel, spriteHeight / SHEET_HERO)
  assert.equal(Math.round((yardCards.tree.h * SHEET_HERO) / spriteHeight), heights[0])
})

test("a pine card is one cell at the hero texel with its foot on the ground", () => {
  const a = treeCard("a")
  const b = treeCard("b")
  assert.ok(Math.abs(a.w - (128 * 32) / 88) < 1e-9)
  assert.ok(Math.abs(a.h - (120 * 32) / 88) < 1e-9)
  assert.deepEqual([a.w, a.h, a.centerY], [b.w, b.h, b.centerY])
  assert.equal(a.centerY, 4 / 120)
  assert.deepEqual(a.repeat, [0.5, 1])
  assert.deepEqual([a.offset, b.offset], [[0, 0], [0.5, 0]])
  assert.throws(() => treeCard("c"), /no pine variant c/)
})

test("trees alternate the pine variants", () => {
  assert.deepEqual([0, 1, 2, 3, -1].map(treeVariant), ["a", "b", "a", "b", "b"])
})

test("render.js draws the yard trees and the forest wall from the pine sheet, not the old tree card", () => {
  const src = fs.readFileSync(path.join(root, "assets/js/render.js"), "utf8")
  assert.doesNotMatch(src, /sheetCard\("tree"/)
  assert.match(src, /sync\("tree", snap\.trees \|\| \[\], \(\) => treeSprite\(1\)\)/)
  assert.match(src, /treeSprite\(slot\.scale, treeVariant\(i\)\)/)
})
