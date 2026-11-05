import { PLAZA_SPAN } from "./ground.js"
import { phash2, pictureCell } from "./horizon.js"
import { forestWall } from "./scenery.js"

// Bushes, rocks and flowers scattered over the yard (between the plaza and the
// forest wall) and along the forest edge (among and just past the wall rings).
// Placement is a pure function of the run's seed and attempt, so every client
// draws the same yard. The count of each kind is fixed whatever the seed, so
// the renderer keeps one pool of sprites and only moves them on a new seed.
const ROADS = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
const PLAZA_HALF = PLAZA_SPAN / 2 + 8
export const floraTries = 12

// count per band; dist ranges in world units from the keep.
export const floraLook = {
  bush: { variants: ["a", "b", "c"], yard: 6, edge: 12 },
  rock: { variants: ["a", "b", "c"], yard: 6, edge: 8 },
  flowers: { variants: ["a", "b"], yard: 12, edge: 4 },
  grass_tufts: { variants: ["a", "b", "c"], yard: 8, edge: 2 },
  stump_log: { variants: ["a", "b"], yard: 0, edge: 4 },
  // A few leafy trees among the forest edge's pines.
  broadleaf: { variants: ["a", "b"], yard: 0, edge: 2 }
}
export const floraBands = {
  yard: { near: 160, far: 205 },
  edge: { near: 205, far: 290 }
}
const KINDS = Object.keys(floraLook)

function angleGap(left, right) {
  const span = Math.abs(left - right) % (Math.PI * 2)
  return Math.min(span, Math.PI * 2 - span)
}

export function floraUnit(values) {
  return phash2(values) / 0x08000000
}

// One candidate on a ring. The deer scatter uses the same hash.
export function bandPoint(seed, attempt, k, b, n, t, near, far) {
  const angle = floraUnit([seed, attempt, k, b, n, t, 0]) * Math.PI * 2
  const dist = near + floraUnit([seed, attempt, k, b, n, t, 1]) * (far - near)
  return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, angle, dist }
}

// Whether (x, z) is free for flora: off the plaza and off the four roads.
export function floraFree(x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) < PLAZA_HALF) return false
  const angle = Math.atan2(z, x)
  return !ROADS.some((road) => angleGap(angle, road) < forestWall().gap)
}

// [{ kind, variant, x, z }], kinds in floraLook order, the same for a seed.
export function floraSlots(seed = 1, attempt = 0) {
  const slots = []
  KINDS.forEach((kind, k) => {
    const look = floraLook[kind]
    for (const [b, band] of Object.keys(floraBands).entries()) {
      const { near, far } = floraBands[band]
      for (let n = 0; n < look[band]; n++) {
        for (let t = 0; t < floraTries; t++) {
          const point = bandPoint(seed, attempt, k, b, n, t, near, far)
          if (!floraFree(point.x, point.z) && t < floraTries - 1) continue
          // The last try always lands: pushed out of the road onto its edge.
          const free = floraFree(point.x, point.z) ? point : offRoad(point.angle, point.dist)
          const variant = look.variants[phash2([seed, attempt, k, b, n, 2]) % look.variants.length]
          slots.push({ kind, variant, x: free.x, z: free.z })
          break
        }
      }
    }
  })
  return slots
}

function offRoad(angle, dist) {
  const gap = forestWall().gap + 0.02
  const road = ROADS.reduce((best, r) => (angleGap(angle, r) < angleGap(angle, best) ? r : best))
  const side = Math.sin(angle - road) >= 0 ? 1 : -1
  const moved = road + side * gap
  const d = Math.max(dist, PLAZA_HALF * 1.5)
  return { x: Math.cos(moved) * d, z: Math.sin(moved) * d }
}

export const floraCount = KINDS.reduce((sum, kind) => sum + floraLook[kind].yard + floraLook[kind].edge, 0)

// Ruin stones sit on ruins-biome cells, the same picture the horizon paints.
// The yard pool stays the rings above. A camera window, capped, so the stones
// stay where that biome is and do not grow with the whole map. y is the
// ruins lift (horizon biomeLift).
const RUIN_CELL = 36
const RUIN_YARD = 380
export const RUIN_CAP = 24
const RUIN_VARIANTS = ["a", "b", "c"]
const RUIN_LIFT = 8

function ruinRange(origin, reach) {
  const min = Math.floor((origin - reach) / RUIN_CELL) - 1
  const max = Math.ceil((origin + reach) / RUIN_CELL) + 1
  return [min, max]
}

export function ruinSlots(seed = 1, attempt = 0, camX = 0, camZ = 0, reach = 2400) {
  const [i0, i1] = ruinRange(camX, reach)
  const [j0, j1] = ruinRange(camZ, reach)
  const found = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * RUIN_CELL
      const z = j * RUIN_CELL
      if (Math.abs(x) < RUIN_YARD && Math.abs(z) < RUIN_YARD) continue
      if (Math.hypot(x - camX, z - camZ) > reach) continue
      if (pictureCell(seed, attempt, x, z) !== "ruins") continue
      found.push({ x, z, hash: phash2([seed, i, j, attempt]) })
    }
  }
  found.sort((a, b) => a.hash - b.hash || a.x - b.x || a.z - b.z)
  return found.slice(0, RUIN_CAP).map((row) => ({
    kind: "ruin_stones",
    variant: RUIN_VARIANTS[row.hash % RUIN_VARIANTS.length],
    x: row.x,
    z: row.z,
    y: RUIN_LIFT
  }))
}
