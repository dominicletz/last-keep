import assert from "node:assert/strict"
import test from "node:test"
import { axes } from "./input.js"
import { combineAxes, contextAction, padSlot, snapGrid, stickVector, touchCapable, turnPrompt, viewportContent } from "./touch.js"

function near(a, b) {
  assert.ok(Math.abs(a.x - b.x) < 1e-9, `${a.x} vs ${b.x}`)
  assert.ok(Math.abs(a.y - b.y) < 1e-9, `${a.y} vs ${b.y}`)
}

test("a feed press and its release share the f bit", () => {
  const slot = padSlot("feed")
  const pad = {}
  pad[slot] = true
  pad[slot] = false
  assert.equal(slot, "f")
  assert.equal(pad.f, false)
  assert.equal(padSlot("place"), "place")
  assert.equal(padSlot("raise"), "raise")
})

test("a full stick matches the WASD axes", () => {
  near(stickVector(0, -64), axes(new Set(["KeyW"])))
  near(stickVector(64, 0), axes(new Set(["KeyD"])))
  near(stickVector(0, 64), axes(new Set(["KeyS"])))
  near(stickVector(-64, 0), axes(new Set(["KeyA"])))
})

test("a stick past the rim stays on the same vector", () => {
  near(stickVector(200, 0), stickVector(64, 0))
  const diagonal = stickVector(80, -80)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9)
})

test("a stick inside the dead zone does not move", () => {
  assert.deepEqual(stickVector(0.18 * 64, 0), { x: 0, y: 0 })
  assert.deepEqual(stickVector(0, 0), { x: 0, y: 0 })
  const nudge = stickVector(0.5 * 64, 0)
  assert.ok(nudge.x > 0)
  assert.ok(nudge.y < 0)
  assert.ok(Math.hypot(nudge.x, nudge.y) < 1)
})

test("keys and the stick add and stay at most unit length", () => {
  const keys = axes(new Set(["KeyW"]))
  near(combineAxes(keys, { x: 0, y: 0 }), keys)
  const both = combineAxes(keys, stickVector(0, -64))
  assert.ok(Math.abs(Math.hypot(both.x, both.y) - 1) < 1e-9)
  near(both, keys)
})

test("touch is a pointer capability, not a user agent", () => {
  assert.equal(touchCapable({ maxTouchPoints: 0, coarse: false, userAgent: "iPhone" }), false)
  assert.equal(touchCapable({ maxTouchPoints: 5, coarse: false, userAgent: "Macintosh" }), true)
  assert.equal(touchCapable({ maxTouchPoints: 0, coarse: true }), true)
  assert.equal(touchCapable(null), false)
})

test("portrait is the only rotate prompt, and a tablet uses it too", () => {
  const phone = { maxTouchPoints: 2, coarse: true }
  assert.equal(turnPrompt({ ...phone, width: 844, height: 390 }), false)
  assert.equal(turnPrompt({ ...phone, width: 390, height: 844 }), true)
  assert.equal(turnPrompt({ maxTouchPoints: 0, coarse: true, width: 768, height: 1024 }), true)
  assert.equal(turnPrompt({ maxTouchPoints: 0, coarse: false, width: 390, height: 844, userAgent: "iPhone" }), false)
})

test("the play viewport locks scale and the idle one does not", () => {
  assert.match(viewportContent(true), /user-scalable=no/)
  assert.match(viewportContent(true), /viewport-fit=cover/)
  assert.doesNotMatch(viewportContent(false), /user-scalable/)
  assert.match(viewportContent(false), /viewport-fit=cover/)
})

test("the context button is a legal place, a paid raise, or a feed", () => {
  const resources = { wood: 48, gold: 0, food: 8 }
  const far = contextAction({
    hero: { x: 120, y: 0, range: 165 },
    keepR: 54,
    resources,
    upgrade: { wood: 24, gold: 8 },
    armed: null,
    buildings: []
  })
  assert.deepEqual(far, { id: "raise", enabled: false })

  const place = contextAction({
    hero: { x: 120, y: 0, range: 165 },
    keepR: 54,
    resources,
    upgrade: { wood: 24, gold: 8 },
    armed: "wall",
    cost: { wood: 8, gold: 0 },
    buildings: []
  })
  assert.equal(place.id, "place")
  assert.equal(place.kind, "wall")
  assert.equal(place.aim.x, snapGrid(place.aim.x))
  assert.equal(place.aim.y, snapGrid(place.aim.y))
  assert.ok(Math.hypot(place.aim.x - 120, place.aim.y) <= 165)
  assert.ok(Math.hypot(place.aim.x, place.aim.y) >= 54 + 28)

  const broke = contextAction({
    hero: { x: 120, y: 0, range: 165 },
    keepR: 54,
    resources: { wood: 2, gold: 0, food: 8 },
    armed: "wall",
    cost: { wood: 8, gold: 0 },
    buildings: []
  })
  assert.equal(broke, null)

  const raise = contextAction({
    hero: { x: 80, y: 0, range: 165 },
    keepR: 54,
    resources: { wood: 40, gold: 10, food: 8 },
    upgrade: { wood: 24, gold: 8 },
    armed: null,
    buildings: []
  })
  assert.deepEqual(raise, { id: "raise", enabled: true })

  const woods = contextAction({
    hero: { x: -232, y: -396, range: 180 },
    keepR: 54,
    resources: { wood: 72, gold: 12, food: 8 },
    upgrade: { wood: 24, gold: 8 },
    armed: null,
    buildings: []
  })
  assert.deepEqual(woods, { id: "raise", enabled: false })

  const feed = contextAction({
    hero: { x: 80, y: 0, range: 165 },
    keepR: 54,
    resources: { wood: 40, gold: 0, food: 8 },
    upgrade: { wood: 24, gold: 8 },
    armed: null,
    buildings: []
  })
  assert.deepEqual(feed, { id: "feed" })

  const building = contextAction({
    hero: { x: 80, y: 0, range: 165 },
    keepR: 54,
    resources: { wood: 40, gold: 10, food: 8 },
    upgrade: { wood: 24, gold: 8 },
    armed: "wall",
    cost: { wood: 8, gold: 0 },
    buildings: []
  })
  assert.equal(building.id, "place")
})
