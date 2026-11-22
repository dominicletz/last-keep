// Pure deterministic biome lookup mirroring LastKeep.Game.World (phash2 + cell bands).
// Kept free of Three.js so pure HUD and client helpers can check biomes directly.

const CELL = 36
const CHUNK = 512
const RADIUS = 7200
const KEEP = 400
const HCONST = 0x9e3779b9
const HCONST_9 = 0x8ff34781

// Erlang round is half away from zero. Math.round sends -0.5 to 0.
export function roundAway(q) {
  if (!Number.isFinite(q)) return 0
  return q >= 0 ? Math.round(q) : -Math.round(-q)
}

function u32(n) {
  return n >>> 0
}

function mix(a, b, c) {
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 13))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 8))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 13))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 12))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 16))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 5))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 3))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 10))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 15))
  return c
}

function uintHash(value, hash, prime) {
  const a = u32(prime + u32(value))
  const b = u32(prime)
  return mix(a, b, hash)
}

// A negative small is mixed twice. The second mix uses the two's-complement bits.
function sintHash(value, hash) {
  const y = value | 0
  if (y < 0) hash = uintHash((-y) >>> 0, hash, HCONST)
  return uintHash(y >>> 0, hash, HCONST)
}

export function phash2(values) {
  let hash = uintHash(values.length, 0, HCONST_9)
  for (const value of values) hash = sintHash(value, hash)
  return hash & 0x07ffffff
}

function inside(i, j) {
  const x = i * CELL
  const y = j * CELL
  const cx = Math.floor(x / CHUNK)
  const cy = Math.floor(y / CHUNK)
  if (cx < -14 || cx > 14 || cy < -14 || cy > 14) return false
  return x * x + y * y <= RADIUS * RADIUS
}

const SMOOTH = [0, 3, 10, 20, 32, 44, 54, 61]

function interp9(h00, h10, h01, h11, shift, wx, wy) {
  const c00 = (h00 >>> shift) & 511
  const c10 = (h10 >>> shift) & 511
  const c01 = (h01 >>> shift) & 511
  const c11 = (h11 >>> shift) & 511
  const top = c00 * (64 - wx) + c10 * wx
  const bot = c01 * (64 - wx) + c11 * wx
  return (top * (64 - wy) + bot * wy) >>> 12
}

function discBiome(seed, attempt, i, j) {
  const x = i * CELL
  const y = j * CELL
  const d2 = x * x + y * y
  if (d2 <= KEEP * KEEP) return "meadow"

  const gx = Math.floor(i / 8)
  const gy = Math.floor(j / 8)
  const fx = i - gx * 8
  const fy = j - gy * 8
  const wx = SMOOTH[fx]
  const wy = SMOOTH[fy]

  const h00 = phash2([seed, attempt, gx, gy])
  const h10 = phash2([seed, attempt, gx + 1, gy])
  const h01 = phash2([seed, attempt, gx, gy + 1])
  const h11 = phash2([seed, attempt, gx + 1, gy + 1])

  const biomeVal = interp9(h00, h10, h01, h11, 0, wx, wy)
  const warpVal = interp9(h00, h10, h01, h11, 9, wx, wy)
  const cliffVal = interp9(h00, h10, h01, h11, 18, wx, wy)

  const rMeta = phash2([seed, attempt, 999])
  const coord = rMeta % 2 === 0 ? i : j
  const along = rMeta % 2 === 0 ? j : i
  const r1 = 28 + (Math.trunc(rMeta / 2) % 18)
  const r2 = -(28 + (Math.trunc(rMeta / 32) % 18))
  const warp = Math.trunc((warpVal - 256) / 24)
  const d1 = Math.abs(coord + warp - r1)
  const d2r = Math.abs(coord + warp - r2)
  const outsideRing = d2 > 740 * 740

  if (outsideRing && (d1 <= 1 || d2r <= 1)) {
    const fordPhase = Math.trunc(rMeta / 512) % 12
    const mod = (((along + fordPhase) % 12) + 12) % 12
    return mod <= 3 ? "ford" : "river"
  }
  if (outsideRing && cliffVal >= 415) return "cliff"
  if (biomeVal < 230) return "pine"
  if (biomeVal > 345) return "ruins"
  return "meadow"
}

function skirtBiome(seed, attempt, i, j) {
  const band = phash2([seed, i, j, attempt]) % 100
  if (band <= 40) return "pine"
  if (band <= 70) return "cliff"
  if (band <= 88) return "hill"
  return "mountain"
}

export function pictureCell(seed, attempt, x, y) {
  const i = roundAway(x / CELL)
  const j = roundAway(y / CELL)
  if (inside(i, j)) return discBiome(seed, attempt, i, j)
  return skirtBiome(seed, attempt, i, j)
}

export function biomeOpen(seed, attempt, x, y) {
  const i = roundAway(x / CELL)
  const j = roundAway(y / CELL)
  if (!inside(i, j)) return false
  const biome = discBiome(seed, attempt, i, j)
  return biome !== "river" && biome !== "cliff"
}

function lineOpen(seed, attempt, x0, y0, x1, y1) {
  const dx = x1 - x0
  const dy = y1 - y0
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return biomeOpen(seed, attempt, x1, y1)
  const px = (-dy / dist) * 16
  const py = (dx / dist) * 16
  const steps = Math.max(1, Math.ceil(dist / 12))
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    const x = x0 + dx * t
    const y = y0 + dy * t
    if (
      !biomeOpen(seed, attempt, x, y) ||
      !biomeOpen(seed, attempt, x + px, y + py) ||
      !biomeOpen(seed, attempt, x - px, y - py)
    ) {
      return false
    }
  }
  return true
}

const routeCache = new Map()

// Cell-grid A* for scripted walks when a river or cliff sits on the straight line
// between the hero and a distant POI. Cached per (seed, attempt, goal) so repeated
// steer polls stay O(path_length).
export function terrainWaypoint(seed, attempt, x, y, goalX, goalY) {
  if (!Number.isInteger(seed)) return { x: goalX, y: goalY }
  if (lineOpen(seed, attempt, x, y, goalX, goalY)) return { x: goalX, y: goalY }
  const gi = roundAway(goalX / CELL)
  const gj = roundAway(goalY / CELL)
  const key = `${seed}:${attempt}:${gi}:${gj}`
  let path = routeCache.get(key)
  if (!path) {
    path = findCellPath(seed, attempt, roundAway(x / CELL), roundAway(y / CELL), gi, gj)
    if (path) {
      if (routeCache.size > 16) routeCache.clear()
      routeCache.set(key, path)
    }
  }
  if (!path || path.length === 0) return { x: goalX, y: goalY }
  // Find the nearest index on the cached path, then look ahead to the farthest
  // directly-visible waypoint so the hero walks smoothly through fords.
  let bestIdx = 0
  let bestDist = Infinity
  for (let k = 0; k < path.length; k++) {
    const d = Math.hypot(path[k].x - x, path[k].y - y)
    if (d < bestDist) {
      bestDist = d
      bestIdx = k
    }
  }
  if (bestDist > 260) {
    // Hero drifted off the cached path; recompute from current cell.
    path = findCellPath(seed, attempt, roundAway(x / CELL), roundAway(y / CELL), gi, gj)
    if (!path || path.length === 0) return { x: goalX, y: goalY }
    routeCache.set(key, path)
    bestIdx = 0
  }
  const limit = Math.min(path.length - 1, bestIdx + 24)
  let target = path[Math.min(path.length - 1, bestIdx + 1)]
  for (let k = limit; k > bestIdx; k--) {
    if (lineOpen(seed, attempt, x, y, path[k].x, path[k].y)) {
      target = path[k]
      break
    }
  }
  if (bestDist > 10 && !lineOpen(seed, attempt, x, y, target.x, target.y)) {
    target = path[bestIdx]
  }
  return target
}

function findCellPath(seed, attempt, si, sj, gi, gj) {
  const keyOf = (i, j) => `${i},${j}`
  const openHeap = [{ i: si, j: sj, g: 0, f: Math.abs(gi - si) + Math.abs(gj - sj) }]
  const gScore = new Map([[keyOf(si, sj), 0]])
  const parent = new Map()
  const closed = new Set()
  const maxNodes = 40000

  const push = (node) => {
    openHeap.push(node)
    let idx = openHeap.length - 1
    while (idx > 0) {
      const p = (idx - 1) >> 1
      if (openHeap[p].f <= openHeap[idx].f) break
      const tmp = openHeap[p]
      openHeap[p] = openHeap[idx]
      openHeap[idx] = tmp
      idx = p
    }
  }

  const pop = () => {
    const top = openHeap[0]
    const last = openHeap.pop()
    if (openHeap.length > 0) {
      openHeap[0] = last
      let idx = 0
      while (true) {
        let best = idx
        const l = idx * 2 + 1
        const r = idx * 2 + 2
        if (l < openHeap.length && openHeap[l].f < openHeap[best].f) best = l
        if (r < openHeap.length && openHeap[r].f < openHeap[best].f) best = r
        if (best === idx) break
        const tmp = openHeap[idx]
        openHeap[idx] = openHeap[best]
        openHeap[best] = tmp
        idx = best
      }
    }
    return top
  }

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1]
  ]

  let visited = 0
  while (openHeap.length > 0 && visited < maxNodes) {
    const cur = pop()
    const ck = keyOf(cur.i, cur.j)
    if (closed.has(ck)) continue
    closed.add(ck)
    visited += 1
    if (cur.i === gi && cur.j === gj) {
      const out = []
      let k = ck
      let ci = gi
      let cj = gj
      while (k) {
        out.push({ x: ci * CELL, y: cj * CELL })
        const prev = parent.get(k)
        if (!prev) break
        ci = prev[0]
        cj = prev[1]
        k = keyOf(ci, cj)
      }
      out.reverse()
      return out
    }
    for (const [di, dj, cost] of dirs) {
      const ni = cur.i + di
      const nj = cur.j + dj
      const nk = keyOf(ni, nj)
      if (closed.has(nk)) continue
      if (!inside(ni, nj)) continue
      const b = discBiome(seed, attempt, ni, nj)
      if (b === "river" || b === "cliff") continue
      let hug = 0
      for (const [oi, oj] of dirs) {
        const nb = discBiome(seed, attempt, ni + oi, nj + oj)
        if (nb === "river" || nb === "cliff") {
          hug = 2
          break
        }
      }
      const ng = cur.g + cost + hug
      const prevG = gScore.get(nk)
      if (prevG === undefined || ng < prevG) {
        gScore.set(nk, ng)
        parent.set(nk, [cur.i, cur.j])
        push({ i: ni, j: nj, g: ng, f: ng + Math.abs(gi - ni) + Math.abs(gj - nj) })
      }
    }
  }
  return null
}
