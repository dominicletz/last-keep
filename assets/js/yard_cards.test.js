import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { buildingCard, cardFallback, yardCards } from "./yard_cards.js"
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
