import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildingCard, buildingSheet, cardFallback, sheetCard, spotVariant, staticSheets, treeCard, treeSheet, treeVariant, yardCards } from "./yard_cards.js"
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

// [top, bottom] opaque rows of each cell of a static sheet.
function sheetRows(name) {
  const sheet = staticSheets[name]
  const image = readRgbaPng(fs.readFileSync(path.join(root, "priv/static", sheet.url)))
  const [cw, ch] = sheet.cell
  assert.equal(image.width, cw * sheet.variants.length, name)
  assert.equal(image.height, ch, name)
  return sheet.variants.map((_, v) => {
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
    return [top, bottom]
  })
}

test("every building sheet matches its asset.json, stands on its foot row and is its card's height", () => {
  const heights = { wall: [110], stone_wall: [110], tower: [132], house: [176], forge: [99], trap: [55, 33] }
  const flora = { bush: [38, 30, 25], rock: [44, 31, 22], flowers: [16, 16], grass_tufts: [14, 11, 9], stump_log: [28, 28], broadleaf: [110, 94] }
  for (const [name, want] of Object.entries({ ...heights, ...flora })) {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "assets/reference", name, "asset.json"), "utf8"))
    const sheet = staticSheets[name]
    assert.deepEqual(sheet.cell, cfg.cell, name)
    assert.deepEqual(sheet.variants, cfg.variants.filter((v) => !v.pending).map((v) => v.id), name)
    const rows = sheetRows(name)
    for (const [top, bottom] of rows) assert.equal(bottom, sheet.footRow, name)
    assert.deepEqual(rows.map(([t, b]) => b - t + 1), want, name)
    if (flora[name]) continue
    const card = yardCards[name] || yardCards[cardFallback[name]]
    assert.equal(Math.round((card.h * 88) / 32), want[0], `${name} is its card's height at the hero texel`)
  }
})

test("the ruin stones and the map table stand on their foot rows", () => {
  const want = { ruin_stones: [55, 30, 28], map_table: [44] }
  for (const [name, heights] of Object.entries(want)) {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "assets/reference", name, "asset.json"), "utf8"))
    const sheet = staticSheets[name]
    assert.deepEqual(sheet.cell, cfg.cell, name)
    assert.deepEqual(sheet.variants, cfg.variants.map((v) => v.id), name)
    const rows = sheetRows(name)
    for (const [, bottom] of rows) assert.equal(bottom, sheet.footRow, name)
    assert.deepEqual(rows.map(([t, b]) => b - t + 1), heights, name)
  }
  assert.equal(buildingSheet("ruin_stones"), "ruin_stones")
  assert.equal(buildingSheet("map_table"), "map_table")
})

test("the quarry, the camp and the shrine stand on their foot rows", () => {
  const want = { quarry: [88, 88], camp: [77], shrine: [66] }
  for (const [name, heights] of Object.entries(want)) {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "assets/reference", name, "asset.json"), "utf8"))
    const sheet = staticSheets[name]
    assert.deepEqual(sheet.cell, cfg.cell, name)
    assert.deepEqual(sheet.variants, cfg.variants.map((v) => v.id), name)
    const rows = sheetRows(name)
    for (const [, bottom] of rows) assert.equal(bottom, sheet.footRow, name)
    assert.deepEqual(rows.map(([t, b]) => b - t + 1), heights, name)
  }
  assert.equal(spotVariant("quarry", 1), "b")
  assert.equal(spotVariant("quarry", 2), "a")
  assert.equal(spotVariant("quarry", -1), "b")
  assert.equal(spotVariant("camp", 5), "a")
  assert.equal(spotVariant("shrine", 2), "a")
  const quarry = sheetCard("quarry", "b")
  assert.equal(quarry.centerY, 4 / 96)
  assert.equal(quarry.w, (176 * 32) / 88)
})

test("buildings with a sheet draw it, stone_wall its own; others keep their card", () => {
  for (const kind of ["wall", "stone_wall", "tower", "house", "forge", "trap"]) assert.equal(buildingSheet(kind), kind)
  for (const kind of ["field", "mage_tower", "pine", "no_such_building"]) assert.equal(buildingSheet(kind), null)
  const t = sheetCard("trap", "b")
  assert.deepEqual([t.repeat, t.offset, t.centerY], [[0.5, 1], [0.5, 0], 4 / 64])
  assert.ok(Math.abs(sheetCard("house", "a").h - (184 * 32) / 88) < 1e-9)
  assert.throws(() => sheetCard("house", "b"), /no house variant b/)
  assert.throws(() => sheetCard("castle", "a"), /no static sheet castle/)
  const src = fs.readFileSync(path.join(root, "assets/js/render.js"), "utf8")
  assert.match(src, /const sheetKind = buildingSheet\(row\.kind\)/)
  assert.match(src, /new THREE\.Sprite\(staticMats\[sheetKind\]\[variant\]\)/)
})
