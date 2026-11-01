import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { heroFronts } from "../hero-data.js"
import { cellOffset, spriteDirections, spriteWalk } from "../pictures.js"
import { readRgbaPng, writeRgbaPng } from "./png.js"

export const WALK_COLUMNS = [
  "front",
  "front-left",
  "shield-side",
  "back-left",
  "back",
  "back-right",
  "open-side",
  "front-right"
]
export const WALK_ROWS = [
  "contact",
  "left-down",
  "left-pass",
  "left-up",
  "contact-right",
  "right-down",
  "right-pass",
  "right-up",
  "idle-0",
  "idle-1",
  "idle-2",
  "idle-3"
]
export const WALK_SHEET = "images/hd2d/warrior-walk.png"
export const WALK_NORMAL = "images/hd2d/warrior-walk-normal.png"

const PLATE = [0xb5, 0xaf, 0xaa]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

export function walkSheetPath(dir = root) {
  return path.join(dir, "priv/static", WALK_SHEET)
}

export function walkNormalPath(dir = root) {
  return path.join(dir, "priv/static", WALK_NORMAL)
}

export function cellOrigin(column, frame, directions, frames, width, height) {
  const cell = cellOffset(column, frame, directions, frames)
  return {
    x: Math.round(cell.x * width),
    y: Math.round((1 - cell.y - cell.repeatY) * height)
  }
}

function decodeWarriorFront() {
  const entry = heroFronts.warrior
  const raw = Uint8Array.from(atob(entry.b64), (char) => char.charCodeAt(0))
  const rgba = new Uint8Array(entry.w * entry.h * 4)
  for (let i = 0; i < entry.w * entry.h; i++) {
    if (!raw[i * 4 + 3]) continue
    rgba[i * 4] = raw[i * 4]
    rgba[i * 4 + 1] = raw[i * 4 + 1]
    rgba[i * 4 + 2] = raw[i * 4 + 2]
    rgba[i * 4 + 3] = 255
  }
  return { rgba, w: entry.w, h: entry.h }
}

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function plateMedian(rgba) {
  const reds = []
  const greens = []
  const blues = []
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const distance = Math.hypot(rgba[i] - PLATE[0], rgba[i + 1] - PLATE[1], rgba[i + 2] - PLATE[2])
    if (distance > 28) continue
    reds.push(rgba[i])
    greens.push(rgba[i + 1])
    blues.push(rgba[i + 2])
  }
  if (!reds.length) return null
  return [median(reds), median(greens), median(blues)]
}

function plateGate(cell, key) {
  const painted = plateMedian(cell)
  const source = plateMedian(key)
  if (!painted || !source) throw new Error("plate")
  const distance = Math.hypot(painted[0] - source[0], painted[1] - source[1], painted[2] - source[2])
  if (distance > 18) throw new Error("plate")
}

function mannequin(key, column, frame) {
  const rgba = new Uint8Array(key.w * key.h * 4)
  const yaw = column * (Math.PI / 4)
  const torso = Math.max(6, Math.round(key.w * 0.22 * Math.abs(Math.cos(yaw)) + key.w * 0.1 * Math.abs(Math.sin(yaw))))
  const cx = Math.floor(key.w / 2) + (frame === 1 ? -2 : frame === 3 ? 2 : 0)
  const lift = frame === 2 ? 1 : 0
  const top = Math.floor(key.h * 0.12) - lift
  const hip = Math.floor(key.h * 0.55)
  for (let y = Math.max(0, top); y < key.h; y++) {
    const leg = y >= hip
    const half = leg ? Math.max(2, Math.floor(torso * 0.28)) : Math.floor(torso / 2)
    const shift = !leg ? 0 : frame === 1 ? (y % 2 === 0 ? -3 : 3) : frame === 3 ? (y % 2 === 0 ? 3 : -3) : 0
    for (let x = cx - half + shift; x <= cx + half + shift; x++) {
      if (x < 0 || x >= key.w) continue
      const o = (y * key.w + x) * 4
      rgba[o] = 90
      rgba[o + 1] = 70
      rgba[o + 2] = 50
      rgba[o + 3] = 255
    }
  }
  if (Math.cos(yaw) > 0.2) {
    const shieldX = Math.min(key.w - 4, cx + torso)
    for (let y = hip - 20; y < hip + 10; y++) {
      for (let x = shieldX; x < shieldX + 4; x++) {
        if (y < 0 || x >= key.w) continue
        const o = (y * key.w + x) * 4
        rgba[o] = 40
        rgba[o + 1] = 70
        rgba[o + 2] = 120
        rgba[o + 3] = 255
      }
    }
  }
  return rgba
}

function proxyGuide(key, column, frame) {
  return {
    column,
    frame,
    yaw: column * (Math.PI / 4),
    name: WALK_COLUMNS[column],
    row: WALK_ROWS[frame],
    cellW: key.w,
    cellH: key.h,
    key: key.rgba,
    proxy: column === 0 && frame === 0 ? key.rgba : mannequin(key, column, frame)
  }
}

export function cleanCell(painted, guide) {
  const w = guide.cellW
  const h = guide.cellH
  if (!painted || painted.w !== w || painted.h !== h || !painted.rgba) throw new Error("cell size")
  const src = painted.rgba
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    if (src[i * 4 + 3] < 128) continue
    rgba[i * 4] = src[i * 4]
    rgba[i * 4 + 1] = src[i * 4 + 1]
    rgba[i * 4 + 2] = src[i * 4 + 2]
    rgba[i * 4 + 3] = 255
  }
  let top = h
  let lowest = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!rgba[(y * w + x) * 4 + 3]) continue
      if (y < top) top = y
      lowest = y
    }
  }
  if (lowest < 0 || h - 1 - lowest > 2) throw new Error("feet")
  if ((lowest - top + 1) / h < 0.7) throw new Error("span")
  const keyCell = guide.column === 0 && guide.frame === 0
  if (!keyCell && sameBytes(rgba, guide.proxy)) throw new Error("proxy")
  if (guide.column !== 0 && sameBytes(rgba, guide.key)) throw new Error("key")
  if (guide.column === 0 && guide.frame !== 0 && sameBytes(rgba, guide.key)) throw new Error("key")
  if (keyCell) plateGate(rgba, guide.key)
  return { rgba, w, h }
}

function shadeByte(value, scale) {
  return Math.max(0, Math.min(255, Math.round(value * scale)))
}

function plantFeet(out, key, w, h) {
  let lowest = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3]) lowest = y
    }
  }
  if (lowest < 0) return
  const drop = h - 1 - lowest
  if (drop > 0 && drop < h) {
    const next = new Uint8Array(out.length)
    for (let y = 0; y < h; y++) {
      const sy = y - drop
      if (sy < 0) continue
      next.set(out.subarray(sy * w * 4, (sy + 1) * w * 4), y * w * 4)
    }
    out.set(next)
  }
  for (let y = h - 2; y < h; y++) {
    if (y < 0) continue
    let row = 0
    for (let x = 0; x < w; x++) row += out[(y * w + x) * 4 + 3] ? 1 : 0
    if (row > 0) continue
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4
      if (key[s + 3] < 128) continue
      out[s] = key[s]
      out[s + 1] = key[s + 1]
      out[s + 2] = key[s + 2]
      out[s + 3] = 255
    }
  }
}

export function conceptPaint(guide) {
  const w = guide.cellW
  const h = guide.cellH
  const key = guide.key
  if (guide.column === 0 && guide.frame === 0) return { rgba: new Uint8Array(key), w, h }
  const out = new Uint8Array(w * h * 4)
  const yaw = guide.column * (Math.PI / 4)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const cx = (w - 1) / 2
  const narrow = 0.46 + 0.54 * Math.abs(cos)
  const hip = Math.floor(h * 0.58)
  const step = guide.frame === 1 ? 6 : guide.frame === 2 ? -2 : guide.frame === 3 ? -6 : 0
  const back = cos < -0.35
  for (let y = 0; y < h; y++) {
    const leg = y >= hip && y < h - 2
    for (let x = 0; x < w; x++) {
      const depth = 1 - Math.min(1, Math.abs(x - cx) / Math.max(cx, 1))
      let srcX = cx + (x - cx) / narrow + sin * depth * w * 0.2
      if (leg) srcX -= (x < cx ? -1 : 1) * step
      if (back) srcX = w - 1 - srcX
      const sx = Math.round(srcX)
      if (sx < 0 || sx >= w) continue
      const s = (y * w + sx) * 4
      if (key[s + 3] < 128) continue
      const d = (y * w + x) * 4
      const shade = back ? 0.58 : 1 - Math.max(0, sin) * 0.12 * depth
      out[d] = shadeByte(key[s], shade)
      out[d + 1] = shadeByte(key[s + 1], shade)
      out[d + 2] = shadeByte(key[s + 2], shade)
      out[d + 3] = 255
    }
  }
  plantFeet(out, key, w, h)
  return { rgba: out, w, h }
}

export function normalsFromAlbedo(rgba, width, height) {
  const out = new Uint8Array(width * height * 4)
  const heightAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0
    const o = (y * width + x) * 4
    if (rgba[o + 3] < 128) return 0
    return (0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2]) / 255
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 2.4
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 2.4
      const len = Math.hypot(dx, dy, 1) || 1
      const o = (y * width + x) * 4
      out[o] = Math.round((-dx / len) * 127.5 + 127.5)
      out[o + 1] = Math.round((-dy / len) * 127.5 + 127.5)
      out[o + 2] = Math.round((1 / len) * 127.5 + 127.5)
      out[o + 3] = rgba[o + 3] >= 128 ? 255 : 0
    }
  }
  return out
}

export async function paintWalkStrip({ paint, file } = {}) {
  if (typeof paint !== "function") throw new Error("paint is required")
  const key = decodeWarriorFront()
  if (WALK_COLUMNS.length !== spriteDirections || WALK_ROWS.length !== spriteWalk) {
    throw new Error("walk sheet")
  }
  const cells = []
  for (let column = 0; column < WALK_COLUMNS.length; column++) {
    for (let frame = 0; frame < WALK_ROWS.length; frame++) {
      const guide = proxyGuide(key, column, frame)
      const painted = await paint(guide)
      cells.push(cleanCell(painted, guide))
    }
  }
  const width = key.w * WALK_COLUMNS.length
  const height = key.h * WALK_ROWS.length
  const packed = new Uint8Array(width * height * 4)
  let index = 0
  for (let column = 0; column < WALK_COLUMNS.length; column++) {
    for (let frame = 0; frame < WALK_ROWS.length; frame++) {
      const cell = cells[index++]
      for (let y = 0; y < key.h; y++) {
        const dx = column * key.w
        const dy = frame * key.h + y
        packed.set(cell.rgba.subarray(y * key.w * 4, (y + 1) * key.w * 4), (dy * width + dx) * 4)
      }
    }
  }
  const out = file || walkSheetPath()
  const normalFile = out.replace(/\.png$/, "-normal.png")
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, writeRgbaPng(packed, width, height))
  const normals = normalsFromAlbedo(packed, width, height)
  fs.writeFileSync(normalFile, writeRgbaPng(normals, width, height))
  return { file: out, normal: normalFile, width, height }
}

export function readWalkSheet(file) {
  return readRgbaPng(fs.readFileSync(file))
}
