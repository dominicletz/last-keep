import assert from "node:assert/strict"
import test from "node:test"
import { bonusCopy, edgeCalls, ignoreFocusClick, nextLine, placementReason, raiseLabel, raiseReady, reasonOpen, showReason, waveLabel } from "./hud.js"

test("the wave label is one number and does not say next", () => {
  assert.equal(waveLabel(1), "Wave 1")
  assert.equal(waveLabel(2), "Wave 2")
  assert.equal(waveLabel(0), "Wave 1")
})

test("the next wave is counted in words", () => {
  assert.equal(nextLine("wave", [{ kind: "goblin", count: 2 }]), "")
  assert.equal(nextLine("build", [{ kind: "goblin", count: 2 }]), "Next: 2 goblins")
  assert.equal(nextLine("build", [{ kind: "wolf", count: 1 }]), "Next: 1 wolf")
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

test("an invalid placement reason fades instead of sticking", () => {
  const shown = showReason({ text: "", until: 0 }, "Too close to the keep", 1000)
  assert.equal(reasonOpen(shown, 1000), true)
  assert.equal(reasonOpen(shown, 3199), true)
  assert.equal(reasonOpen(shown, 3200), false)
  const held = showReason(shown, "Too close to the keep", 2000)
  assert.equal(held.until, shown.until)
  const again = showReason(shown, "Too close to the keep", 4000, 2200, true)
  assert.equal(again.until, 6200)
})

test("forge, spire, and relics are explained", () => {
  const quiet = bonusCopy({ forge: false, mage_tower: false, relics: [] })
  assert.match(quiet.forge, /15%/)
  assert.match(quiet.spire, /recover faster/)
  const lit = bonusCopy({ forge: true, mage_tower: true, relics: ["whetstone"] })
  assert.match(lit.forge, /Forge is lit/)
  assert.match(lit.relics[0], /10%/)
})

test("raising the keep names the wood and gold it costs", () => {
  assert.equal(raiseLabel({ wood: 24, gold: 8, rank: 1 }), "Raise the keep  24 wood 8 gold")
  assert.equal(raiseLabel(null), "The keep is as high as it goes")
  assert.equal(raiseReady({ wood: 24, gold: 8 }, { wood: 48, gold: 2 }), false)
  assert.equal(raiseReady({ wood: 24, gold: 8 }, { wood: 48, gold: 8 }), true)
  assert.equal(raiseReady(null, { wood: 48, gold: 8 }), false)
})

test("offscreen monsters in one direction share a counted call", () => {
  const calls = edgeCalls([
    { kind: "goblin", x: 600, y: 40 },
    { kind: "goblin", x: 640, y: -20 },
    { kind: "skeleton", x: -500, y: 30 }
  ])
  const labels = calls.map((call) => call.label).sort()
  assert.deepEqual(labels, ["2 goblins", "skeleton"])
})
