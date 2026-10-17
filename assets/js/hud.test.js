import assert from "node:assert/strict"
import test from "node:test"
import { CAPTION_GLASS, CHROME_BUDGET, bonusCopy, callAnchor, chromeCount, clockText, consumePlace, edgeCalls, hintBeacon, hintBeacons, ignoreFocusClick, nextLine, placementReason, raiseLabel, raiseReady, rangeRingState, reasonOpen, rosterAnchor, sackLine, showReason, waveClock, waveLabel } from "./hud.js"

test("a place event clears the armed build once per tick", () => {
  const snap = { tick: 5, events: [{ type: "place" }] }
  const first = consumePlace(snap, null)
  assert.deepEqual(first, { clear: true, seenTick: 5 })
  assert.deepEqual(consumePlace(snap, first.seenTick), { clear: false, seenTick: 5 })
  assert.deepEqual(consumePlace({ tick: 6, events: [] }, first.seenTick), { clear: false, seenTick: 5 })
})

test("the wave clock counts down to frenzy and then says they are faster", () => {
  assert.equal(clockText({ phase: "wave", phase_ms: 58000 }), "Frenzy in 58s")
  assert.equal(clockText({ phase: "wave", phase_ms: 1000, enraged: true }), "Frenzied. They are faster")
  assert.equal(clockText({ hold: true, phase: "build", phase_ms: 1000 }), "Waiting to start")
  assert.equal(clockText({ phase: "build", phase_ms: 10000 }), "Night in 10s")
  assert.match(clockText({ phase: "wave", phase_ms: 58000 }), waveClock)
  assert.match(clockText({ phase: "wave", phase_ms: 1000, enraged: true }), waveClock)
  assert.doesNotMatch(clockText({ phase: "build", phase_ms: 10000 }), waveClock)
})

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

test("an edge call beside the roster stops short of the names", () => {
  const roster = { left: 0.78, top: 0, right: 0.98, bottom: 0.36 }
  const parked = callAnchor(0.9, 0.12, roster)
  assert.ok(parked.left < roster.left)
  assert.equal(parked.end, true)
  const open = callAnchor(0.2, 0.5, roster)
  assert.ok(Math.abs(open.left - 0.2) < 0.001)
  assert.equal(open.end, false)
})

test("an armed build draws a ring the size of the hero's reach", () => {
  assert.deepEqual(rangeRingState(true, 180), { on: true, radius: 180 })
  assert.deepEqual(rangeRingState(false, 180), { on: false, radius: 0 })
  assert.deepEqual(rangeRingState(true, 0), { on: false, radius: 0 })
})

test("the glass keeps ten controls after the sacks leave it", () => {
  assert.equal(CHROME_BUDGET, 10)
  assert.ok(CHROME_BUDGET < CAPTION_GLASS)
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-chrome]")
      return Array.from({ length: CHROME_BUDGET })
    }
  }
  assert.equal(chromeCount(root), CHROME_BUDGET)
  assert.equal(chromeCount(null), 0)
})

test("wood, food, and gold each sit in their own sack", () => {
  const marks = sackLine({ wood: 40, food: 12, gold: 3 })
  assert.deepEqual(marks.map((mark) => mark.text), ["Wood 40", "Food 12", "Gold 3"])
  assert.equal(new Set(marks.map((mark) => `${mark.x},${mark.y}`)).size, 3)
})

test("a hinted pack stands on its approach bearing", () => {
  const east = hintBeacon({ angle: 0, kind: "goblin", count: 2 })
  assert.ok(Math.abs(east.x - 520) < 0.001)
  assert.ok(Math.abs(east.y) < 0.001)
  assert.equal(east.label, "2 goblins")
  const north = hintBeacon({ angle: Math.PI / 2, kind: "wolf", count: 1 })
  assert.ok(Math.abs(north.x) < 0.001)
  assert.ok(north.y > 500)
  assert.equal(north.label, "1 wolf")
  assert.equal(hintBeacons([{ angle: 0, kind: "goblin", count: 2 }]).length, 1)
  assert.deepEqual(hintBeacons([]), [])
})

test("the roster board sits west of the party", () => {
  const board = rosterAnchor([
    { x: 20, y: 10 },
    { x: 40, y: 30 }
  ])
  assert.equal(board.x, -250)
  assert.equal(board.y, -30)
  assert.deepEqual(rosterAnchor([]), { x: -150, y: 40 })
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
