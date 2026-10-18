const assert = require("node:assert/strict")
const { test } = require("node:test")
const { clearanceVia, keysToward, walkHitsKeep } = require("./steer")

const BODY = 68
const SPEED = 155
const DT = 0.05

function axes(keys) {
  const f = Math.SQRT1_2
  const set = new Set(keys)
  let x = 0
  let y = 0
  if (set.has("KeyW")) {
    x -= f
    y -= f
  }
  if (set.has("KeyS")) {
    x += f
    y += f
  }
  if (set.has("KeyD")) {
    x += f
    y -= f
  }
  if (set.has("KeyA")) {
    x -= f
    y += f
  }
  const length = Math.hypot(x, y)
  if (length > 1) return { x: x / length, y: y / length }
  return { x, y }
}

function step(x, y, target) {
  const a = axes(keysToward({ x, y }, target))
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
  let detour = 0
  let via = null
  while (t < 45 && Math.hypot(goal.x - x, goal.y - y) > 30) {
    const hits = walkHitsKeep({ x, y }, goal)
    let target = goal
    if (hits && detour < 20) {
      if (!via) via = clearanceVia({ x, y }, goal)
      target = via
      detour += DT
    }
    const next = step(x, y, target)
    if (next.moved < 0.01) {
      return { ok: false, x, y, t, detour, keys: keysToward({ x, y }, target) }
    }
    x = next.x
    y = next.y
    t += DT
  }
  return { ok: Math.hypot(goal.x - x, goal.y - y) <= 30, t, detour, x, y }
}

test("a chest left of the face is a west walk", () => {
  assert.deepEqual(keysToward({ x: 73.5, y: 0 }, { x: -900, y: 40 }), ["KeyA", "KeyW"])
})

test("a goal north of the band keeps the north step", () => {
  assert.deepEqual(keysToward({ x: 120, y: 0 }, { x: -40, y: -400 }), ["KeyW", "KeyD"])
})

test("the face at x 73.5 takes a via that shares x", () => {
  const here = { x: 73.5, y: 0 }
  const goal = { x: -1600, y: 80 }
  const via = clearanceVia(here, goal)
  assert.equal(via.x, here.x)
  const keys = keysToward(here, via)
  assert.notDeepEqual(keys, ["KeyA", "KeyW"])
  assert.ok(keys.includes("KeyS") || keys.includes("KeyW"))
})

test("a hero on the face or the spawn reaches a chest without sticking", () => {
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
      assert.ok(result.detour < 5, JSON.stringify(result))
      assert.ok(result.t < 45, JSON.stringify(result))
    }
  }
})
