import * as THREE from "three"
import { deflateSync, inflateSync } from "node:zlib"
import { cameraDistance } from "../js/town.js"
import { frameFor } from "../js/frame.js"
import { skyColor } from "../js/scene.js"

// Gallery rigs. Material colors are shaded after the palette check.
// Day is the concept sky. Dusk and night are darker shades of that sky.
// Flame and torch colors emit, so a night window stays lit.
const EMISSIVE = new Set([0xeea821, 0xf5751e])

function rgbOf(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function scaleRgb(hex, factor) {
  return rgbOf(hex).map((channel) => Math.round(channel * factor))
}

export const galleryRigs = {
  day: {
    bg: rgbOf(skyColor),
    ambient: [0.62, 0.56, 0.48],
    key: [0.5, 0.42, 0.3],
    keyDir: normalize([0.45, 1, 0.2]),
    point: null,
    emission: 0.12
  },
  dusk: {
    bg: scaleRgb(skyColor, 0.62),
    ambient: [0.32, 0.22, 0.18],
    key: [0.24, 0.14, 0.08],
    keyDir: normalize([0.2, 0.5, 0.12]),
    point: { pos: [26, 42, 26], color: [0.35, 0.16, 0.04], range: 150 },
    emission: 0.4
  },
  night: {
    bg: scaleRgb(skyColor, 0.2),
    ambient: [0.24, 0.2, 0.26],
    key: [0.04, 0.03, 0.05],
    keyDir: normalize([-0.15, 0.4, -0.1]),
    point: { pos: [26, 42, 26], color: [0.85, 0.36, 0.08], range: 72 },
    emission: 0.5
  }
}

export const lightNames = ["day", "dusk", "night"]

export function gameFrame() {
  const frame = frameFor(1280, 800, 0)
  const dist = cameraDistance(0)
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 2400)
  camera.position.set(dist, dist * 0.9, dist)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return { frame, camera }
}

export function renderParts(parts, light) {
  const rig = galleryRigs[light]
  if (!rig) throw new Error(`unknown light ${light}`)
  const { frame, camera } = gameFrame()
  const width = frame.bufferWidth
  const height = frame.bufferHeight
  const rgb = new Uint8Array(width * height * 3)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = rig.bg[0]
    rgb[i * 3 + 1] = rig.bg[1]
    rgb[i * 3 + 2] = rig.bg[2]
  }
  const faces = []
  let order = 0
  for (const part of parts) {
    for (const face of facesOf(part)) {
      const projected = face.poly.map((point) => project(camera, width, height, point))
      let depth = 0
      for (const point of projected) depth += point.z
      depth /= projected.length
      const center = centroid(face.poly)
      faces.push({
        projected,
        depth,
        order: order++,
        color: shade(part.color, face.normal, center, rig)
      })
    }
  }
  faces.sort((a, b) => b.depth - a.depth || a.order - b.order)
  for (const face of faces) {
    const poly = face.projected
    if (poly.length < 3) continue
    for (let i = 1; i < poly.length - 1; i++) fillTriangle(rgb, mask, width, height, poly[0], poly[i], poly[i + 1], face.color)
  }
  return { rgb, mask, width, height }
}

export function stackHorizontal(images) {
  const height = images[0].height
  const width = images.reduce((sum, image) => sum + image.width, 0)
  const rgb = new Uint8Array(width * height * 3)
  let x0 = 0
  for (const image of images) {
    if (image.height !== height) throw new Error("sheet panels differ in height")
    for (let y = 0; y < height; y++) {
      rgb.set(image.rgb.subarray(y * image.width * 3, (y + 1) * image.width * 3), (y * width + x0) * 3)
    }
    x0 += image.width
  }
  return { rgb, width, height }
}

// Nearest-neighbor crop, letterboxed on the soil ground from the theme sheet.
export function blitCrop(sheet, crop, destW, destH) {
  const rgb = new Uint8Array(destW * destH * 3)
  for (let i = 0; i < destW * destH; i++) {
    rgb[i * 3] = 0x08
    rgb[i * 3 + 1] = 0x0c
    rgb[i * 3 + 2] = 0x0e
  }
  const scale = Math.min(destW / crop.w, destH / crop.h)
  const drawW = Math.max(1, Math.floor(crop.w * scale))
  const drawH = Math.max(1, Math.floor(crop.h * scale))
  const originX = Math.floor((destW - drawW) / 2)
  const originY = Math.floor((destH - drawH) / 2)
  for (let y = 0; y < drawH; y++) {
    const sy = Math.min(crop.h - 1, Math.floor(y / scale))
    for (let x = 0; x < drawW; x++) {
      const sx = Math.min(crop.w - 1, Math.floor(x / scale))
      const srcX = Math.min(sheet.width - 1, Math.max(0, crop.x + sx))
      const srcY = Math.min(sheet.height - 1, Math.max(0, crop.y + sy))
      const src = (srcY * sheet.width + srcX) * 4
      const offset = ((originY + y) * destW + (originX + x)) * 3
      rgb[offset] = sheet.data[src]
      rgb[offset + 1] = sheet.data[src + 1]
      rgb[offset + 2] = sheet.data[src + 2]
    }
  }
  return { rgb, width: destW, height: destH }
}

export function missingConcept(width, height) {
  const rgb = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x < 6 || y < 6 || x >= width - 6 || y >= height - 6
      const band = y > height * 0.45 && y < height * 0.55
      const shade = border ? 0xf3 : band ? 0x6a : (x + y) % 16 < 2 ? 0x3a : 0x1a
      const o = (y * width + x) * 3
      rgb[o] = shade
      rgb[o + 1] = border ? 0xe6 : band ? 0x4a : 0x14
      rgb[o + 2] = border ? 0xcf : band ? 0x30 : 0x0f
    }
  }
  return { rgb, width, height }
}

export function cropMask(image, pad = 6) {
  let minX = image.width
  let minY = image.height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < image.mask.length; i++) {
    if (!image.mask[i]) continue
    const x = i % image.width
    const y = (i / image.width) | 0
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (maxX < 0) return null
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(image.width - 1, maxX + pad)
  maxY = Math.min(image.height - 1, maxY + pad)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const rgb = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const src = ((minY + y) * image.width + minX) * 3
    rgb.set(image.rgb.subarray(src, src + width * 3), y * width * 3)
  }
  return { rgb, width, height }
}

export function maskArea(mask) {
  let area = 0
  for (let i = 0; i < mask.length; i++) area += mask[i]
  return area
}

export function maskIou(a, b) {
  if (a.length !== b.length) return 1
  let inter = 0
  let union = 0
  for (let i = 0; i < a.length; i++) {
    const left = a[i] ? 1 : 0
    const right = b[i] ? 1 : 0
    inter += left & right
    union += left | right
  }
  if (union === 0) return 1
  return inter / union
}

export function meanLuma(image) {
  let sum = 0
  let count = 0
  for (let i = 0; i < image.mask.length; i++) {
    if (!image.mask[i]) continue
    const o = i * 3
    sum += 0.2126 * image.rgb[o] + 0.7152 * image.rgb[o + 1] + 0.0722 * image.rgb[o + 2]
    count += 1
  }
  if (count === 0) return 0
  return sum / count
}

export function pixelDiff(a, b) {
  if (a.length !== b.length) return a.length + b.length
  let count = 0
  for (let i = 0; i < a.length; i += 3) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count += 1
  }
  return count
}

export function encodePng(image) {
  const { rgb, width, height } = image
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, row + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))])
}

export function decodePng(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (bytes[0] !== 137 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("not a png")
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const rgb = new Uint8Array(width * height * 3)
  const stride = width * 3
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1)
    if (raw[row] !== 0) throw new Error("gallery png filter is not 0")
    rgb.set(raw.subarray(row + 1, row + 1 + stride), y * stride)
  }
  return { rgb, width, height }
}

function facesOf(part) {
  if (part.shape === "box") return boxFaces(part)
  return prismFaces(asPrism(part))
}

function asPrism(part) {
  if (part.shape === "prism") return part
  if (part.shape === "cone") {
    return { ...part, rt: 0, rb: part.w / 2, h: part.h, segments: part.segments || 4 }
  }
  throw new Error(`${part.name || "part"} has unknown shape ${part.shape}`)
}

function boxFaces(part) {
  const hx = part.w / 2
  const hy = part.h / 2
  const hz = part.d / 2
  const p = (x, y, z) => [part.x + x, part.y + y, part.z + z]
  const v = [
    p(-hx, -hy, -hz),
    p(hx, -hy, -hz),
    p(hx, hy, -hz),
    p(-hx, hy, -hz),
    p(-hx, -hy, hz),
    p(hx, -hy, hz),
    p(hx, hy, hz),
    p(-hx, hy, hz)
  ]
  const quads = [
    [3, 2, 6, 7],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [4, 0, 3, 7],
    [4, 7, 6, 5],
    [0, 1, 2, 3]
  ]
  return quads.map((quad) => ({ poly: quad.map((index) => v[index]) })).map((face) => withNormal(part, face))
}

function prismFaces(part) {
  const n = part.segments || 5
  const top = []
  const bot = []
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2
    top.push([part.x + Math.cos(angle) * part.rt, part.y + part.h / 2, part.z + Math.sin(angle) * part.rt])
    bot.push([part.x + Math.cos(angle) * part.rb, part.y - part.h / 2, part.z + Math.sin(angle) * part.rb])
  }
  const faces = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    faces.push({ poly: [bot[i], bot[j], top[j], top[i]] })
  }
  if (part.rt > 0) faces.push({ poly: top })
  if (part.rb > 0) faces.push({ poly: [...bot].reverse() })
  return faces.map((face) => withNormal(part, face))
}

function withNormal(part, face) {
  let normal = faceNormal(face.poly)
  const center = centroid(face.poly)
  const outward = [center[0] - part.x, center[1] - part.y, center[2] - part.z]
  if (dot(normal, outward) < 0) normal = [-normal[0], -normal[1], -normal[2]]
  return { poly: face.poly, normal }
}

function faceNormal(poly) {
  const a = poly[0]
  const b = poly[1]
  const c = poly[2]
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  return normalize([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx])
}

function centroid(poly) {
  const c = [0, 0, 0]
  for (const point of poly) {
    c[0] += point[0]
    c[1] += point[1]
    c[2] += point[2]
  }
  c[0] /= poly.length
  c[1] /= poly.length
  c[2] /= poly.length
  return c
}

const projectedPoint = new THREE.Vector3()

function project(camera, width, height, point) {
  projectedPoint.set(point[0], point[1], point[2])
  projectedPoint.project(camera)
  return {
    x: (projectedPoint.x * 0.5 + 0.5) * width,
    y: (-projectedPoint.y * 0.5 + 0.5) * height,
    z: projectedPoint.z
  }
}

function shade(hex, normal, center, rig) {
  const ndotl = Math.max(0, dot(normal, rig.keyDir))
  let pr = 0
  let pg = 0
  let pb = 0
  if (rig.point) {
    const dx = rig.point.pos[0] - center[0]
    const dy = rig.point.pos[1] - center[1]
    const dz = rig.point.pos[2] - center[2]
    const dist = Math.hypot(dx, dy, dz) || 1
    const falloff = Math.max(0, 1 - dist / rig.point.range)
    const facing = Math.max(0, (normal[0] * dx + normal[1] * dy + normal[2] * dz) / dist)
    const scale = falloff * facing
    pr = rig.point.color[0] * scale
    pg = rig.point.color[1] * scale
    pb = rig.point.color[2] * scale
  }
  const mr = ((hex >> 16) & 255) / 255
  const mg = ((hex >> 8) & 255) / 255
  const mb = (hex & 255) / 255
  const emit = EMISSIVE.has(hex) ? rig.emission || 0 : 0
  return [
    clampByte(mr * (rig.ambient[0] + rig.key[0] * ndotl + pr + emit)),
    clampByte(mg * (rig.ambient[1] + rig.key[1] * ndotl + pg + emit)),
    clampByte(mb * (rig.ambient[2] + rig.key[2] * ndotl + pb + emit))
  ]
}

export function nightContrast(image) {
  let max = 0
  let sum = 0
  let count = 0
  let bright = 0
  let warm = 0
  let bg = 0
  let bgCount = 0
  for (let i = 0; i < image.mask.length; i++) {
    const o = i * 3
    const r = image.rgb[o]
    const g = image.rgb[o + 1]
    const b = image.rgb[o + 2]
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (!image.mask[i]) {
      bg += luma
      bgCount += 1
      continue
    }
    sum += luma
    count += 1
    if (luma > max) max = luma
    if (luma >= 48) {
      bright += 1
      if (r > g && r > b + 8) warm += 1
    }
  }
  return {
    max,
    mean: count === 0 ? 0 : sum / count,
    bright,
    warm,
    bg: bgCount === 0 ? 0 : bg / bgCount
  }
}

function clampByte(value) {
  if (value <= 0) return 0
  if (value >= 1) return 255
  return Math.round(value * 255)
}

function fillTriangle(rgb, mask, width, height, a, b, c, color) {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)))
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)))
  const area = edge(a, b, c)
  if (area === 0) return
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = { x: x + 0.5, y: y + 0.5 }
      const w0 = edge(b, c, p)
      const w1 = edge(c, a, p)
      const w2 = edge(a, b, p)
      const inside = area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0
      if (!inside) continue
      const index = y * width + x
      const o = index * 3
      rgb[o] = color[0]
      rgb[o + 1] = color[1]
      rgb[o + 2] = color[2]
      mask[index] = 1
    }
  }
}

function edge(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

let crcTable = null

function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
