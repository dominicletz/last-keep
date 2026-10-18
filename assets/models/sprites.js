import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildCard } from "../js/pictures.js"
import { loadSheet } from "./sheets.js"

export { pictureColumn, spriteDirections, spriteFrames, spriteHeight } from "../js/pictures.js"

// One painted card per hero, cut from heroes.jpg. Eight directions and four
// walk frames share one cell. The gallery and the yard draw that card instead
// of the voxel boxes. Direction 0 is the crop, the view the gallery camera sees.
const root = fileURLToPath(new URL("../../", import.meta.url))

const CROPS = {
  warrior: { x: 24, y: 158, w: 268, h: 412 },
  mage: { x: 312, y: 124, w: 196, h: 448 },
  scout: { x: 524, y: 100, w: 216, h: 480 },
  farmer: { x: 752, y: 98, w: 250, h: 480 },
  engineer: { x: 1016, y: 158, w: 224, h: 432 }
}

export const MONSTER_CROPS = {
  goblin: { x: 16, y: 328, w: 236, h: 246 },
  skeleton: { x: 260, y: 328, w: 260, h: 246 },
  wolf: { x: 760, y: 340, w: 270, h: 245 },
  troll: { x: 524, y: 292, w: 226, h: 286 },
  bat: { x: 408, y: 68, w: 260, h: 96 },
  boss: { x: 1000, y: 70, w: 275, h: 520 }
}

const cache = new Map()
let sheet
let monsterSheet

function heroesSheet() {
  if (!sheet) sheet = loadSheet(path.join(root, "docs/concept/heroes.jpg"))
  return sheet
}

function monstersSheet() {
  if (!monsterSheet) monsterSheet = loadSheet(path.join(root, "docs/concept/monsters.jpg"))
  return monsterSheet
}

export function monsterCropFigure(kind) {
  const crop = MONSTER_CROPS[kind]
  if (!crop) throw new Error(`no monster crop for ${kind}`)
  // A dark rider, a wolf, and a bat break into separate bright islands.
  // The crop is one figure, so every island stays.
  return cutFigure(monstersSheet(), crop, "all", "dense")
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function cropFigure(kind) {
  return cutFigure(heroesSheet(), CROPS[kind])
}

function cutFigure(source, crop, parts = "largest", ink = "hero") {
  const rgb = new Uint8Array(crop.w * crop.h * 3)
  const raw = new Uint8Array(crop.w * crop.h)
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const s = ((crop.y + y) * source.width + crop.x + x) * 4
      const i = y * crop.w + x
      const r = source.data[s]
      const g = source.data[s + 1]
      const b = source.data[s + 2]
      rgb[i * 3] = r
      rgb[i * 3 + 1] = g
      rgb[i * 3 + 2] = b
      const L = luma(r, g, b)
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      const on = ink === "dense" ? L >= 16 || chroma >= 12 : L >= 28 && (L >= 36 || chroma >= 12)
      if (on) raw[i] = 1
    }
  }
  const mask = parts === "all" ? raw : largest(raw, crop.w, crop.h)
  return trim({ rgb, mask, w: crop.w, h: crop.h })
}

function largest(mask, w, h) {
  const seen = new Uint8Array(mask.length)
  let best = []
  const stack = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    const comp = []
    stack.push(i)
    seen[i] = 1
    while (stack.length) {
      const p = stack.pop()
      comp.push(p)
      const x = p % w
      const next = [p - 1, p + 1, p - w, p + w]
      for (const q of next) {
        if (q < 0 || q >= mask.length || seen[q] || !mask[q]) continue
        const qx = q % w
        if (Math.abs(qx - x) > 1) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    if (comp.length > best.length) best = comp
  }
  const out = new Uint8Array(mask.length)
  for (const p of best) out[p] = 1
  return out
}

function trim(image) {
  let minX = image.w
  let minY = image.h
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < image.mask.length; i++) {
    if (!image.mask[i]) continue
    const x = i % image.w
    const y = (i / image.w) | 0
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const rgb = new Uint8Array(w * h * 3)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (minY + y) * image.w + minX + x
      if (!image.mask[s]) continue
      const d = y * w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w, h }
}

function build(kind) {
  return buildCard(cropFigure(kind), kind)
}

export function heroCrops() {
  return CROPS
}

export function heroPicture(kind) {
  if (!CROPS[kind]) throw new Error(`no hero picture for ${kind}`)
  if (!cache.has(kind)) cache.set(kind, build(kind))
  return cache.get(kind)
}

export function conceptFigure(kind) {
  const part = heroPicture(kind)[0]
  return part.image
}

// The gallery camera sits on +X+Z. Direction 0 is that view. Facing is the
// sim aim. viewYaw is atan2(cameraX - heroX, cameraZ - heroZ).
function figureBox(mask, w, h) {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % w
    const y = (i / w) | 0
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (maxX < 0) return null
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function sampleSquare(rgb, mask, w, h, box, size) {
  const out = new Uint8Array(size * size * 3)
  const bits = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const sy = box.minY + ((y + 0.5) * box.h) / size
    const iy = Math.min(h - 1, Math.max(0, sy | 0))
    for (let x = 0; x < size; x++) {
      const sx = box.minX + (box.w - box.h) / 2 + ((x + 0.5) * box.h) / size
      const ix = sx | 0
      if (ix < 0 || ix >= w || !mask[iy * w + ix]) continue
      const d = (y * size + x) * 3
      const s = (iy * w + ix) * 3
      out[d] = rgb[s]
      out[d + 1] = rgb[s + 1]
      out[d + 2] = rgb[s + 2]
      bits[y * size + x] = 1
    }
  }
  return { rgb: out, mask: bits }
}

export function likenessScore(image, figure) {
  const leftBox = figureBox(figure.mask, figure.w, figure.h)
  const rightBox = figureBox(image.mask, image.width, image.height)
  if (!leftBox || !rightBox) return { iou: 0, rmse: 255 }
  const size = 48
  const left = sampleSquare(figure.rgb, figure.mask, figure.w, figure.h, leftBox, size)
  const right = sampleSquare(image.rgb, image.mask, image.width, image.height, rightBox, size)
  let inter = 0
  let union = 0
  let err = 0
  let n = 0
  for (let i = 0; i < left.mask.length; i++) {
    const a = left.mask[i] ? 1 : 0
    const b = right.mask[i] ? 1 : 0
    inter += a & b
    union += a | b
    if (!a && !b) continue
    const o = i * 3
    err += (left.rgb[o] - right.rgb[o]) ** 2 + (left.rgb[o + 1] - right.rgb[o + 1]) ** 2 + (left.rgb[o + 2] - right.rgb[o + 2]) ** 2
    n += 1
  }
  return {
    iou: union ? inter / union : 0,
    rmse: n ? Math.sqrt(err / (n * 3)) : 255
  }
}

export function sheetBytes() {
  return fs.readFileSync(path.join(root, "docs/concept/heroes.jpg"))
}
