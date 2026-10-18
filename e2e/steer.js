const { keysAround } = require("../assets/js/input.js")

const BODY = 68
const STEP = 12

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

function keysFor(here, goal) {
  return keysAround(here.x, here.y, goal.x, goal.y)
}

function walkHitsKeep(here, goal) {
  const a = axes(keysFor(here, goal))
  const nx = here.x + a.x * STEP
  const ny = here.y + a.y * STEP
  return Math.hypot(nx, ny) < BODY
}

module.exports = { axes, keysFor, walkHitsKeep }
