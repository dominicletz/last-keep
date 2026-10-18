import assert from "node:assert/strict"
import test from "node:test"
import { CAPTION_GLASS, CHROME_BUDGET, KEEP_SIGN, bonusCopy, buildFace, callAnchor, callRect, chromeCount, clockText, consumePlace, edgeCalls, hintBeacon, hintBeacons, ignoreFocusClick, nextLine, parkCall, parkRect, pinRect, placementReason, raiseHint, raiseLabel, raiseReady, rangeRingState, reasonOpen, rectsOverlap, rosterAnchor, sackLine, seatCaptions, seatPhoneHud, seatPin, seatSacks, showReason, spreadCalls, visiblePin, waveAnchor, waveClock, waveLabel } from "./hud.js"

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

test("a disabled raise away from the keep says to walk there", () => {
  const offer = { wood: 24, gold: 8, rank: 1 }
  assert.equal(raiseHint(true, { x: -122, y: -252 }, offer), "Walk to the keep")
  assert.equal(raiseHint(true, { x: 120, y: 0 }, offer), "Walk to the keep")
  assert.equal(raiseHint(true, { x: 40, y: 0 }, offer), "")
  assert.equal(raiseHint(false, { x: -122, y: -252 }, offer), "")
  assert.equal(raiseHint(true, { x: -122, y: -252 }, null), "")
})

test("an edge call beside the roster stops short of the names", () => {
  const roster = { left: 0.78, top: 0, right: 0.98, bottom: 0.36 }
  const parked = callAnchor(0.9, 0.12, roster)
  assert.ok(parked.left < roster.left)
  assert.equal(parked.end, true)
  const open = callAnchor(0.2, 0.5, roster)
  assert.ok(Math.abs(open.left - 0.2) < 0.001)
  assert.equal(open.end, false)
  const west = { left: 0.04, top: 0.2, right: 0.22, bottom: 0.55 }
  const beside = callAnchor(0.1, 0.32, west)
  assert.equal(beside.end, false)
  assert.ok(beside.left >= west.right)
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

test("a touch build drops the digit and a desktop build keeps it", () => {
  assert.deepEqual(buildFace("wall", { wood: 8, gold: 0 }, true), { title: "Wall", price: "8 wood" })
  assert.deepEqual(buildFace("mage_tower", { wood: 18, gold: 30 }, false), { title: "6 Spire", price: "18 wood 30 gold" })
  assert.equal(buildFace("forge", null, true).title, "Forge")
  assert.equal(buildFace("forge", null, true).price, "")
})

test("piled sacks on a phone separate, and clear sacks stay where they were", () => {
  const box = { width: 90, height: 70 }
  const boxes = [box, box, box]
  const piled = [
    { key: "wood", left: 420, top: 200 },
    { key: "food", left: 430, top: 210 },
    { key: "gold", left: 410, top: 190 }
  ]
  const keep = { left: 390, top: 130, right: 470, bottom: 230 }
  const seated = seatSacks(piled, { width: 844, height: 390 }, boxes, keep)
  const rects = seated.map((spot) => pinRect(spot, box, "sack"))
  for (let i = 0; i < rects.length; i += 1) {
    assert.equal(rectsOverlap(rects[i], keep), false)
    for (let j = i + 1; j < rects.length; j += 1) assert.equal(rectsOverlap(rects[i], rects[j]), false)
  }
  const clear = [
    { key: "wood", left: 200, top: 200 },
    { key: "food", left: 700, top: 220 },
    { key: "gold", left: 400, top: 500 }
  ]
  const stayed = seatSacks(clear, { width: 1280, height: 800 }, boxes, null)
  assert.deepEqual(
    stayed.map(({ left, top }) => ({ left, top })),
    clear.map(({ left, top }) => ({ left, top }))
  )
})

test("wood, food, and gold each sit in their own sack", () => {
  const marks = sackLine({ wood: 40, food: 12, gold: 3 })
  assert.deepEqual(marks.map((mark) => mark.text), ["Wood 40", "Food 12\nFeast 10", "Gold 3"])
  assert.match(marks[1].text, /Food 12/)
  assert.match(marks[1].text, /Feast 10/)
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

test("a west pack that crosses the seam is one call", () => {
  const at = (angle, radius) => ({
    kind: "goblin",
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  })
  const calls = edgeCalls([at(-2.2, 600), at(-3.05, 620), at(3.05, 640)])
  assert.deepEqual(
    calls.map((call) => call.label),
    ["3 goblins"]
  )
})

test("a goblin pair across a compass boundary is one call, and it stays under the raise bar", () => {
  const left = { kind: "goblin", x: Math.cos(0.35) * 640, y: Math.sin(0.35) * 640 }
  const right = { kind: "goblin", x: Math.cos(0.44) * 620, y: Math.sin(0.44) * 620 }
  const calls = edgeCalls([left, right])
  assert.deepEqual(calls.map((call) => call.label), ["2 goblins"])
  const covered = callAnchor(0.2, 0.04, null, { bottom: 0.16 })
  assert.ok(covered.top >= 0.2)
  const stacked = spreadCalls([
    { left: 0.2, top: 0.3, label: "goblin" },
    { left: 0.22, top: 0.31, label: "skeleton" }
  ])
  assert.ok(stacked[1].top - stacked[0].top >= 0.06)
})

test("a seat on a large view clears a block without a full-screen fine scan", () => {
  const block = { left: 400, top: 300, right: 520, bottom: 380 }
  const bounds = { left: 0, top: 0, right: 1280, bottom: 800 }
  const started = performance.now()
  for (let i = 0; i < 40; i += 1) {
    const parked = parkRect({ left: 430, top: 320, right: 520, bottom: 400 }, [block], bounds)
    assert.equal(rectsOverlap(parked, block), false)
  }
  assert.ok(performance.now() - started < 150)
})

test("on a phone the food sack, the roster, and the goblin call keep their own seats", () => {
  const sizes = [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 932, height: 430 }
  ]
  for (const view of sizes) {
    const heart = { left: view.width * 0.46, top: view.height * 0.46, right: view.width * 0.46 + 120, bottom: view.height * 0.46 + 28 }
    const shot = { left: view.width - 150, top: view.height - 140, right: view.width - 64, bottom: view.height - 54 }
    const builds = { left: 8, top: view.height - 58, right: view.width - 250, bottom: view.height - 8 }
    const stick = { left: 12, top: view.height - 150, right: 124, bottom: view.height - 28 }
    const sackBox = { width: 90, height: 78 }
    const sacks = [
      { key: "wood", left: view.width * 0.42, top: view.height * 0.62 },
      { key: "food", left: heart.left + 40, top: heart.bottom + 10 },
      { key: "gold", left: view.width * 0.58, top: view.height * 0.66 }
    ]
    const foodHome = pinRect(sacks[1], sackBox, "sack")
    assert.equal(rectsOverlap(foodHome, heart), true, `${view.width} food starts on the health line`)
    const keep = { left: view.width * 0.44, top: view.height * 0.28, right: view.width * 0.56, bottom: view.height * 0.55 }
    const roster = { spot: { left: 36, top: view.height * 0.34 }, box: { width: 168, height: 118 } }
    const relic = { spot: { left: 150, top: view.height * 0.5 }, box: { width: 230, height: 52 } }
    assert.equal(rectsOverlap(pinRect(roster.spot, roster.box, "corner"), pinRect(relic.spot, relic.box, "chip")), true)
    const seated = seatPhoneHud({
      view,
      sacks,
      boxes: [sackBox, sackBox, sackBox],
      keep,
      heart,
      controls: [shot, builds, stick],
      roster,
      relic,
      limit: shot.top - 8,
      floor: 46
    })
    const placed = [
      ...seated.sacks.map((spot) => pinRect(spot, sackBox, "sack")),
      pinRect(seated.roster, roster.box, "corner"),
      pinRect(seated.relic, relic.box, "chip")
    ]
    const blocked = [heart, shot, builds, stick, keep, ...placed]
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = 0; j < blocked.length; j += 1) {
        if (placed[i] === blocked[j]) continue
        assert.equal(rectsOverlap(placed[i], blocked[j]), false, `${view.width} seat ${i} hits ${j}`)
      }
    }
    const raw = callAnchor(0.93, 0.74, null, null)
    assert.equal(rectsOverlap(callRect(raw, { width: 84, height: 18 }, view), shot), true)
    const volume = { left: view.width - 170, top: 6, right: view.width - 12, bottom: 34 }
    const onVolume = { left: (volume.left + 8) / view.width, top: 8 / view.height, end: false, label: "2 goblins" }
    assert.equal(rectsOverlap(callRect(onVolume, { width: 84, height: 18 }, view), volume), true)
    const parked = parkCall(onVolume, { width: 84, height: 18 }, [volume, shot, builds, stick, heart, ...placed], view)
    const call = callRect(parked, { width: 84, height: 18 }, view)
    for (const block of [volume, shot, builds, stick, heart, ...placed]) {
      assert.equal(rectsOverlap(call, block), false, `${view.width} call`)
    }
  }
})

test("a far roster and the relic lines stay above the build bar", () => {
  const view = { width: 1280, height: 800 }
  const limit = 740
  const bar = { left: 0, top: limit, right: view.width, bottom: view.height }
  const roster = { spot: { left: -200, top: 2000 }, box: { width: 180, height: 120 } }
  const relic = { spot: { left: 40, top: 1900 }, box: { width: 260, height: 54 } }
  const seated = seatCaptions(roster, relic, view, limit, 48)
  const rosterRect = pinRect(seated.roster, roster.box, "corner")
  const relicRect = pinRect(seated.relic, relic.box, "chip")
  assert.equal(rectsOverlap(rosterRect, bar), false)
  assert.equal(rectsOverlap(relicRect, bar), false)
  assert.equal(rectsOverlap(rosterRect, relicRect), false)
  const phoneBar = { left: 0, top: 300, right: 844, bottom: 390 }
  const phone = seatCaptions(
    { spot: { left: -80, top: 900 }, box: { width: 150, height: 100 } },
    { spot: { left: 20, top: 880 }, box: { width: 220, height: 48 } },
    { width: 844, height: 390 },
    phoneBar.top,
    36
  )
  const phoneRoster = pinRect(phone.roster, { width: 150, height: 100 }, "corner")
  const phoneRelic = pinRect(phone.relic, { width: 220, height: 48 }, "chip")
  assert.equal(rectsOverlap(phoneRoster, phoneBar), false)
  assert.equal(rectsOverlap(phoneRelic, phoneBar), false)
  assert.equal(rectsOverlap(phoneRoster, phoneRelic), false)
  const clear = seatCaptions(
    { spot: { left: 40, top: 80 }, box: { width: 160, height: 90 } },
    { spot: { left: 900, top: 200 }, box: { width: 200, height: 40 } },
    view,
    limit,
    8
  )
  assert.deepEqual(clear.roster, { left: 40, top: 80 })
  assert.deepEqual(clear.relic, { left: 900, top: 200 })
})

test("the wave sign follows the hero and stays inside the window", () => {
  assert.deepEqual(waveAnchor(null), { x: KEEP_SIGN.x, y: KEEP_SIGN.y })
  const near = waveAnchor({ x: 40, y: 10 })
  assert.equal(near.x, -24)
  assert.equal(near.y, -54)
  const pinned = visiblePin({ left: -80, top: -40 }, { width: 1280, height: 800 }, { width: 280, height: 22 })
  assert.ok(pinned.left >= 8 + 140)
  assert.ok(pinned.top >= 8 + 22 * 1.2)
  const far = visiblePin({ left: 2000, top: 2000 }, { width: 1280, height: 800 }, { width: 280, height: 22 })
  assert.ok(far.left <= 1280 - 8 - 140)
  assert.ok(far.top <= 800 - 72)
  const board = visiblePin({ left: 30, top: -1.2 }, { width: 1280, height: 800 }, { width: 160, height: 120 }, "corner")
  assert.ok(board.top >= 8)
  assert.ok(board.top + 120 <= 800 - 8)
  assert.equal(board.left, 30)
  const below = visiblePin({ left: 30, top: 12 }, { width: 1280, height: 800 }, { width: 160, height: 120 }, "corner", 72)
  assert.ok(below.top >= 72)
  const low = callAnchor(0.2, 0.96, null)
  assert.ok(low.top <= 0.78)
})

test("the wave line seats clear of the sacks", () => {
  const view = { width: 1280, height: 800 }
  const box = { width: 640, height: 22 }
  const obstacles = [
    { left: 470, top: 300, right: 560, bottom: 370 },
    { left: 560, top: 360, right: 650, bottom: 430 },
    { left: 400, top: 380, right: 490, bottom: 450 },
    { left: 600, top: 470, right: 720, bottom: 510 },
    { left: 10, top: 10, right: 626, bottom: 52 },
    { left: 0, top: 762, right: 1280, bottom: 790 }
  ]
  const spot = { left: 640, top: 420 }
  const home = visiblePin(spot, view, box)
  assert.ok(obstacles.some((block) => rectsOverlap(pinRect(home, box), block)))
  const seated = seatPin(spot, view, box, obstacles)
  const rect = pinRect(seated, box)
  for (const block of obstacles) assert.equal(rectsOverlap(rect, block), false)
  assert.ok(rect.left >= 8)
  assert.ok(rect.top >= 8)
  assert.ok(rect.right <= view.width - 8)
  assert.ok(rect.bottom <= view.height - 72)
  const clearSpot = { left: 960, top: 140 }
  assert.deepEqual(seatPin(clearSpot, view, { width: 180, height: 22 }, obstacles), visiblePin(clearSpot, view, { width: 180, height: 22 }))
})
