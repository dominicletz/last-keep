// Runtime view of priv/footprints.json. The sim reads the same file.
// A body overlaps a polygon when its center is inside the polygon grown by
// its radius. A step that raises the score is walking out, so a hero who is
// already inside can leave.

import table from "../../priv/footprints.json" with { type: "json" }

const AXES = table.axes
const KINDS = table.kinds
const ALIAS = table.alias

export function footprintTable() {
  return table
}

export function sheetKey(kind) {
  return ALIAS[kind] || kind
}

export function blockingKind(kind) {
  return table.block.includes(kind)
}

export function footprintOf(kind, variant) {
  const sheet = KINDS[sheetKey(kind)]
  if (!sheet) return null
  return sheet[variant] || sheet[Object.keys(sheet)[0]] || null
}

export function variantFor(kind, id) {
  const sheet = KINDS[sheetKey(kind)]
  if (!sheet) return "a"
  const keys = Object.keys(sheet)
  if (kind === "keep") {
    const rank = Math.max(0, Math.min(keys.length - 1, id | 0))
    return String(rank)
  }
  if (keys.length < 2) return keys[0]
  const n = keys.length
  const index = ((Math.trunc(id) % n) + n) % n
  return keys[index]
}

function localOf(x, y) {
  return {
    u: x * AXES.ux + y * AXES.uy,
    v: x * AXES.vx + y * AXES.vy
  }
}

function segmentGap(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 < 1e-12 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function polygon(spec) {
  if (spec.poly && spec.poly.length >= 3) return spec.poly
  return [
    [0, spec.hy],
    [spec.hx, 0],
    [0, -spec.hy],
    [-spec.hx, 0]
  ]
}

function insidePoly(u, v, poly) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0])
    if (cross < -1e-6) return false
  }
  return true
}

export function footprintGap(kind, variant, x, y) {
  const spec = footprintOf(kind, variant)
  if (!spec) return Infinity
  const { u, v } = localOf(x, y)
  const poly = polygon(spec)
  if (insidePoly(u, v, poly)) return 0
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const d = segmentGap(u, v, a[0], a[1], b[0], b[1])
    if (d < best) best = d
  }
  return best
}

export function footprintScore(kind, variant, x, y) {
  const spec = footprintOf(kind, variant)
  if (!spec) return Infinity
  const { u, v } = localOf(x, y)
  return Math.hypot(u, v)
}

export function footprintBlocks(kind, variant, x, y, radius, from) {
  if (footprintGap(kind, variant, x, y) >= radius) return false
  if (!from) return true
  return footprintScore(kind, variant, x, y) <= footprintScore(kind, variant, from.x, from.y) + 1e-4
}

export function keepBlocks(x, y, radius, from, rank = 0) {
  return footprintBlocks("keep", variantFor("keep", rank), x, y, radius, from)
}

export function footprintSeat(kind, variant) {
  const spec = footprintOf(kind, variant)
  if (!spec) return { x: 0, y: 0, z: 0 }
  return { x: -spec.anchor[0], y: 0, z: -spec.anchor[1] }
}

export function footprintPlane(kind, variant) {
  const spec = footprintOf(kind, variant)
  if (!spec || !spec.plane) return { x: 0, z: 0 }
  return { x: spec.plane[0], z: spec.plane[1] }
}
