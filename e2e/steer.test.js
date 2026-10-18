const assert = require("node:assert/strict")
const { test } = require("node:test")
const { keysAround } = require("../assets/js/input.js")
const { axes, keysFor, walkHitsKeep } = require("./steer")

const BODY = 68
const SPEED = 155
const DT = 0.05

function step(x, y, goal) {
  const a = axes(keysFor({ x, y }, goal))
  let nx = x + a.x * SPEED * DT
  let ny = y + a.y * SPEED * DT
  if (Math.hypot(nx, ny) < BODY) {
    if (Math.hypot(nx, y) >= BODY && Math.abs(nx - x) > 0.2) ny = y
    else if (Math.hypot(x, ny) >= BODY && Math.abs(ny - y) > 0.2) nx = x
    else {
      nx = x
      ny = y
    }
  }
  return { x: nx, y: ny, moved: Math.hypot(nx - x, ny - y) }
}

function walk(start, goal) {
  let x = start.x
  let y = start.y
  let t = 0
  while (t < 45 && Math.hypot(goal.x - x, goal.y - y) > 30) {
    const next = step(x, y, goal)
    if (next.moved < 0.01) return { ok: false, x, y, t, keys: keysFor({ x, y }, goal) }
    x = next.x
    y = next.y
    t += DT
  }
  return { ok: Math.hypot(goal.x - x, goal.y - y) <= 30, t, x, y }
}

test("the keep face takes the tangent, not due west", () => {
  const keys = keysAround(73.5, 0, -400, 80)
  assert.deepEqual(keysFor({ x: 73.5, y: 0 }, { x: -400, y: 80 }), keys)
  assert.notDeepEqual(keys, ["KeyA", "KeyW"])
  assert.equal(walkHitsKeep({ x: 73.5, y: 0 }, { x: -400, y: 80 }), false)
})

test("a goal beyond the face still walks straight", () => {
  assert.deepEqual(keysAround(200, 0, -400, 0), ["KeyA", "KeyW"])
})

test("a hero on the face or the spawn reaches a chest", () => {
  const starts = [
    { x: 73.5, y: 0 },
    { x: 120, y: 0 }
  ]
  for (const start of starts) {
    for (let deg = 0; deg < 360; deg += 45) {
      const angle = (deg * Math.PI) / 180
      const goal = { x: Math.cos(angle) * 900, y: Math.sin(angle) * 900 }
      const result = walk(start, goal)
      assert.equal(result.ok, true, JSON.stringify({ start, goal, result }))
      assert.ok(result.t < 45, JSON.stringify(result))
    }
  }
})
