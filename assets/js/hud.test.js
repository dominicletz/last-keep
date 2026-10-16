import assert from "node:assert/strict"
import test from "node:test"
import { bonusCopy, ignoreFocusClick, placementReason, waveLabel } from "./hud.js"

test("the wave label is one number and does not say next", () => {
  assert.equal(waveLabel(1), "Wave 1")
  assert.equal(waveLabel(2), "Wave 2")
  assert.equal(waveLabel(0), "Wave 1")
})

test("the click that focuses the window is not an attack", () => {
  assert.equal(ignoreFocusClick(false), true)
  assert.equal(ignoreFocusClick(true), false)
})

test("an illegal wall explains itself", () => {
  const me = { x: 120, y: 0, range: 165, cost: { wood: 8, gold: 0 } }
  assert.equal(placementReason(me, { x: 0, y: 0 }, { wood: 48, gold: 0 }), "Too close to the keep")
  assert.equal(placementReason(me, { x: 400, y: 0 }, { wood: 48, gold: 0 }), "Too far")
  assert.equal(placementReason(me, { x: 160, y: 0 }, { wood: 2, gold: 0 }), "Not enough wood")
  assert.equal(placementReason(me, { x: 160, y: 0 }, { wood: 48, gold: 0 }), "")
})

test("forge, spire, and relics are explained", () => {
  const quiet = bonusCopy({ forge: false, mage_tower: false, relics: [] })
  assert.match(quiet.forge, /15%/)
  assert.match(quiet.spire, /recover faster/)
  const lit = bonusCopy({ forge: true, mage_tower: true, relics: ["whetstone"] })
  assert.match(lit.forge, /Forge is lit/)
  assert.match(lit.relics[0], /10%/)
})
