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

// North is the way off the keep toward the west caption mark. y < -220 is
// that line. A walk that has already gained 40 and then sits for stallMs is
// on the face or in the trees, so the caption walk steps outward. No gain at
// all steps out after three seconds. Arriving ends the leg.
function noteNorth(mark, y, now, stallMs = 700) {
  if (y < -220) return { action: "arrived", mark }
  if (!mark) return { action: "hold", mark: { start: y, best: y, at: now } }
  if (y < mark.best - 2) return { action: "hold", mark: { start: mark.start, best: y, at: now } }
  const gained = mark.best < mark.start - 40
  if (gained && now - mark.at > stallMs) return { action: "step-out", mark }
  if (!gained && now - mark.at > 3000) return { action: "step-out", mark }
  return { action: "hold", mark }
}

// A heading is kept while the server position keeps gaining. The turn happens
// when that gain stops, not because a hold lasted a fixed time.
function noteProgress(mark, score, now, stallMs = 700) {
  if (!mark) return { action: "hold", mark: { best: score, at: now, heading: 0 } }
  if (score > mark.best + 4) return { action: "hold", mark: { best: score, at: now, heading: mark.heading } }
  if (now - mark.at > stallMs) return { action: "turn", mark: { best: mark.best, at: now, heading: mark.heading + 1 } }
  return { action: "hold", mark }
}

// A moving hero changes cell between snapshots. Arrival is two snapshots
// after the keys are up that still share a position. The same tick twice
// is one sample, and a later tick at a new position is still walking.
function stoppedTick(previous, fresh) {
  if (!previous || !fresh) return false
  return fresh.tick > previous.tick && fresh.x === previous.x && fresh.y === previous.y
}

// The pose comes from the stopped snapshot. Fields the goal already read
// stay, and a field the goal does not use is left off the sample.
function settleFields(last, fresh) {
  const settled = { ...last, x: fresh.x, y: fresh.y }
  if (Object.prototype.hasOwnProperty.call(last, "alive")) settled.alive = fresh.alive
  if (Object.prototype.hasOwnProperty.call(last, "raiseReady")) settled.raiseReady = fresh.raiseReady
  if (Object.prototype.hasOwnProperty.call(last, "held")) settled.held = fresh.held
  if (Object.prototype.hasOwnProperty.call(last, "cloth")) settled.cloth = fresh.cloth
  if (Object.prototype.hasOwnProperty.call(last, "table")) settled.table = fresh.table
  return settled
}

module.exports = { axes, keysFor, walkHitsKeep, noteNorth, noteProgress, stoppedTick, settleFields }
