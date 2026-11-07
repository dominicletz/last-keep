import { bandPoint, floraBands, floraFree, floraTries, floraUnit } from "./flora.js"
import { forestWall } from "./scenery.js"

// Deer are client-side decoration. Nothing in the simulation owns them.
// Homes are a pure function of the run's seed, on the same forest-edge ring
// as the flora (`floraBands.edge`, 205–290), off the plaza and the four roads.
// Each deer grazes, walks an arc that stays on that ring, grazes, and walks
// back. Grazing plays the attack rows (there is no idle clip). Flee is not
// a clip and is not simulated here.
// The tag sits outside the flora kind indexes so the two scatters do not share homes.
const DEER_TAG = 9
const SWEEPS = [0.4, 0.24, 0.12]

export const deerBand = floraBands.edge
export const deerCount = 4
export const DEER_GRAZE_MS = 4800
export const DEER_WALK_MS = 3200

// Walker sheet from sprite_from_video.py: cell 128, figure 60, outline row
// 121 (cell - 8 + 1). Rows are walk 8, attack 6, death 6. The attack rows
// are the graze.
export const DEER_SHEET = {
  cell: 128,
  figure: 60,
  footRow: 121,
  world: 22,
  rows: { walk: 8, attack: 6, death: 6 }
}

export function deerSheetUrl() {
  return "images/hd2d/deer-sheet.png"
}

export function deerCycle() {
  return 2 * (DEER_GRAZE_MS + DEER_WALK_MS)
}

function arcClear(radius, angle, sweep) {
  const steps = 8
  for (let i = 0; i <= steps; i++) {
    const a = angle + (sweep * i) / steps
    if (!floraFree(Math.cos(a) * radius, Math.sin(a) * radius)) return false
  }
  return true
}

function pickSweep(radius, angle) {
  for (const mag of SWEEPS) {
    for (const sign of [1, -1]) {
      const sweep = sign * mag
      if (arcClear(radius, angle, sweep)) return sweep
    }
  }
  return 0
}

// Snap a blocked angle out to the near edge of the road gap, keeping radius.
function clearAngle(angle) {
  const gap = forestWall().gap + 0.02
  const roads = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  const span = (left, right) => {
    const turn = Math.abs(left - right) % (Math.PI * 2)
    return Math.min(turn, Math.PI * 2 - turn)
  }
  const road = roads.reduce((best, r) => (span(angle, r) < span(angle, best) ? r : best))
  if (span(angle, road) >= gap) return angle
  const side = Math.sin(angle - road) >= 0 ? 1 : -1
  return road + side * gap
}

// [{ x, z, radius, angle, sweep, offset }], deerCount of them, every seed.
export function deerSlots(seed = 1, attempt = 0) {
  const { near, far } = deerBand
  const cycle = deerCycle()
  const slots = []
  for (let n = 0; n < deerCount; n++) {
    let chosen = null
    for (let t = 0; t < floraTries; t++) {
      const point = bandPoint(seed, attempt, DEER_TAG, 1, n, t, near, far)
      if (!floraFree(point.x, point.z)) continue
      const sweep = pickSweep(point.dist, point.angle)
      if (!sweep && t < floraTries - 1) continue
      chosen = point
      chosen.sweep = sweep
      break
    }
    if (!chosen) {
      const point = bandPoint(seed, attempt, DEER_TAG, 1, n, floraTries - 1, near, far)
      const angle = clearAngle(point.angle)
      const radius = Math.min(far, Math.max(near, point.dist))
      chosen = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        angle,
        dist: radius,
        sweep: pickSweep(radius, angle)
      }
    }
    slots.push({
      x: chosen.x,
      z: chosen.z,
      radius: chosen.dist,
      angle: chosen.angle,
      sweep: chosen.sweep,
      offset: Math.floor(floraUnit([seed, attempt, DEER_TAG, n, 5]) * cycle)
    })
  }
  return slots
}

function mod(value, cycle) {
  const wrapped = value % cycle
  return wrapped < 0 ? wrapped + cycle : wrapped
}

// Where the deer is at `now` milliseconds of sim time (tick * 50). Pure, so
// every client draws the same animal. `moving` plays walk; `graze` plays attack.
export function deerAt(slot, now) {
  const grazeMs = DEER_GRAZE_MS
  const walkMs = DEER_WALK_MS
  const leg = grazeMs + walkMs
  const phase = mod(now + slot.offset, leg * 2)
  const outbound = phase < leg
  const local = outbound ? phase : phase - leg
  const grazing = local < grazeMs || !slot.sweep
  const along = grazing ? 0 : (local - grazeMs) / walkMs
  const travel = outbound ? along : 1 - along
  const angle = slot.angle + slot.sweep * travel
  const x = Math.cos(angle) * slot.radius
  const z = Math.sin(angle) * slot.radius
  const sweepSign = slot.sweep < 0 ? -1 : 1
  const dir = (outbound ? 1 : -1) * sweepSign
  const facing = Math.atan2(dir * Math.cos(angle), -dir * Math.sin(angle))
  return {
    x,
    z,
    facing,
    moving: !grazing && slot.sweep !== 0,
    graze: grazing || slot.sweep === 0
  }
}
