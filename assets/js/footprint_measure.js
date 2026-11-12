// Measures one sheet cell into a ground polygon. script/footprints.mjs is the
// only writer of priv/footprints.json. The procedure is in
// docs/concepts/ART-PIPELINE.md under Footprints.

export const FOOT_TEXEL = 32 / 88

function round2(n) {
  return Math.round(n * 100) / 100
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6
}

// Rank-0 gameplay camera. picture.seat at town rank 0, 1280×800, fov 15.
// Eye sits on (150, 0.9*150 - 32, 150), span = 168 / tan(7.5°).
export function groundCamera() {
  const halfH = 168
  const fov = (15 * Math.PI) / 180
  const span = halfH / Math.tan(fov / 2)
  const dist = 150
  const rise = 0.9 * dist - 32
  const len = Math.hypot(dist, rise, dist)
  const zx = dist / len
  const zy = rise / len
  const zz = dist / len
  let rx = zz
  let rz = -zx
  const rl = Math.hypot(rx, rz)
  rx /= rl
  rz /= rl
  const uy = zz * rx - zx * rz
  const ux = zy * rz
  const uz = -zy * rx
  return {
    cam: { x: zx * span, y: 32 + zy * span, z: zz * span },
    right: { x: rx, y: 0, z: rz },
    up: { x: ux, y: uy, z: uz },
    toward: { x: zx, z: zz }
  }
}

export function measureAxes() {
  const { right, toward } = groundCamera()
  const vlen = Math.hypot(toward.x, toward.z)
  return {
    ux: round6(right.x),
    uy: round6(right.z),
    vx: round6(-toward.x / vlen),
    vy: round6(-toward.z / vlen)
  }
}

function project(cam, right, up, sx, sy, worldUp) {
  const px = sx * right.x + (worldUp ? 0 : sy * up.x)
  const py = worldUp ? sy : sy * up.y
  const pz = sx * right.z + (worldUp ? 0 : sy * up.z)
  const dx = px - cam.x
  const dy = py - cam.y
  const dz = pz - cam.z
  const t = (0 - cam.y) / dy
  return { x: cam.x + t * dx, z: cam.z + t * dz }
}

// Ground point of one sheet pixel when the foot row sits at the origin.
// mode "plane" is a vertical card. A sprite faces the camera.
export function projectPixel(cellW, cellH, col, row, mode = "sprite") {
  const footRow = cellH - 5
  const centerY = (cellH - 1 - footRow) / cellH
  const { cam, right, up } = groundCamera()
  const u = (col + 0.5) / cellW
  const v = (cellH - row - 0.5) / cellH
  const sx = (u - 0.5) * cellW * FOOT_TEXEL
  const sy = (v - centerY) * cellH * FOOT_TEXEL
  return project(cam, right, up, sx, sy, mode === "plane")
}

// Painted base of one cell.
// mode "plane" is a vertical card (the hell door). Anything else is a
// camera-facing sprite. The widest opaque row in the bottom 45% of the figure
// is the floor's left and right corners. The lowest opaque pixel is the front
// apex. The back apex mirrors the front through those corners: that is the
// floor the building stands on, including the part the walls cover.
// A figure that comes out more than twice as deep as it is wide is a row of
// stakes. Its center is the first row that reaches the stake width, so the
// shaft is not mirrored into a long slab.
export function measureCell(rgba, width, height, cellW, variantIndex, mode = "sprite") {
  const x0 = variantIndex * cellW
  const widths = new Int16Array(height)
  const lefts = new Int16Array(height)
  const rights = new Int16Array(height)
  let minY = height
  let maxY = 0
  for (let y = 0; y < height; y++) {
    let lo = cellW
    let hi = -1
    for (let x = 0; x < cellW; x++) {
      if (rgba[(y * width + x0 + x) * 4 + 3] > 0) {
        if (x < lo) lo = x
        if (x > hi) hi = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (hi >= 0) {
      widths[y] = hi - lo + 1
      lefts[y] = lo
      rights[y] = hi
    }
  }
  const figH = Math.max(1, maxY - minY + 1)
  const band = maxY - Math.round(figH * 0.45)
  let peak = 0
  let peakY = maxY
  for (let y = Math.max(minY, band); y <= maxY; y++) {
    if (widths[y] > peak) {
      peak = widths[y]
      peakY = y
    }
  }
  const { right, toward } = groundCamera()
  function pix(col, row) {
    return projectPixel(cellW, height, col, row, mode)
  }
  let frontX = 0
  let frontN = 0
  for (let x = 0; x < cellW; x++) {
    if (rgba[(maxY * width + x0 + x) * 4 + 3] > 0) {
      frontX += x
      frontN += 1
    }
  }
  frontX = frontN ? frontX / frontN : cellW / 2
  const axisU = { x: right.x, z: right.z }
  const vlen = Math.hypot(toward.x, toward.z)
  const axisV = { x: -toward.x / vlen, z: -toward.z / vlen }
  function uv(p) {
    return { u: p.x * axisU.x + p.z * axisU.z, v: p.x * axisV.x + p.z * axisV.z }
  }
  function diamond(centerRow) {
    const left = uv(pix(lefts[centerRow], centerRow))
    const rightC = uv(pix(rights[centerRow], centerRow))
    const front = uv(pix(frontX, maxY))
    const cu = (left.u + rightC.u) / 2
    const cv = (left.v + rightC.v) / 2
    const hx = Math.abs(rightC.u - left.u) / 2
    const hy = Math.abs(cv - front.v)
    const cx = cu * axisU.x + cv * axisV.x
    const cz = cu * axisU.z + cv * axisV.z
    return { hx, hy, cx, cz, centerRow }
  }
  let shape = diamond(peakY)
  if (shape.hy > shape.hx * 2) {
    let shoulder = maxY
    for (let y = maxY; y >= minY; y--) {
      if (widths[y] >= peak * 0.85) {
        shoulder = y
        break
      }
    }
    shape = diamond(shoulder)
  }
  const yaw = Math.PI / 4
  const localX = shape.cx * Math.cos(yaw) + shape.cz * -Math.sin(yaw)
  const localZ = shape.cx * Math.sin(yaw) + shape.cz * Math.cos(yaw)
  const poly = basePoly(rgba, width, cellW, x0, shape, uv, pix, maxY)
  return {
    hx: round2(Math.max(shape.hx, 1)),
    hy: round2(Math.max(shape.hy, 1)),
    anchor: [round2(shape.cx), round2(shape.cz)],
    plane: [round2(-localX), round2(-localZ)],
    poly,
    baseRow: shape.centerRow,
    footRow: maxY
  }
}

function basePoly(rgba, width, cellW, x0, shape, uv, pix, footRow) {
  const points = [
    [0, shape.hy],
    [shape.hx, 0],
    [0, -shape.hy],
    [-shape.hx, 0]
  ]
  const originUv = uv({ x: shape.cx, z: shape.cz })
  for (let y = shape.centerRow; y <= footRow; y++) {
    let lo = -1
    let hi = -1
    for (let x = 0; x < cellW; x++) {
      if (rgba[(y * width + x0 + x) * 4 + 3] === 0) continue
      if (lo < 0) lo = x
      hi = x
    }
    if (lo < 0) continue
    for (const x of lo === hi ? [lo] : [lo, hi]) {
      const p = uv(pix(x, y))
      points.push([p.u - originUv.u, p.v - originUv.v])
    }
  }
  return simplifyHull(convexHull(points), 1.5)
}

function convexHull(points) {
  const seen = new Set()
  const uniq = []
  for (const point of points) {
    const key = `${round2(point[0])},${round2(point[1])}`
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push([round2(point[0]), round2(point[1])])
  }
  uniq.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (uniq.length < 3) return uniq
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const point of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper = []
  for (let i = uniq.length - 1; i >= 0; i--) {
    const point = uniq[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function simplifyHull(poly, limit) {
  const ring = poly.slice()
  while (ring.length > 6) {
    let best = Infinity
    let at = -1
    for (let i = 0; i < ring.length; i++) {
      const prev = ring[(i + ring.length - 1) % ring.length]
      const next = ring[(i + 1) % ring.length]
      const d = pointSeg(ring[i], prev, next)
      if (d < best) {
        best = d
        at = i
      }
    }
    if (best > limit) break
    ring.splice(at, 1)
  }
  return ring
}

function pointSeg(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 < 1e-12 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t))
}
