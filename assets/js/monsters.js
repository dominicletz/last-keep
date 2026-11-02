import { lockInk, lockedPalette, styleHexes } from "./art_score.js"
import { monsterRim } from "./bodies.js"
import { monsterFronts } from "./monster-data.js"
import { monsterSheets } from "./monster-sheets.js"
import { buildCard } from "./pictures.js"

// World height of the crop card. Goblins, skeletons, wolves, and bats stay
// under the hero. The troll and the rider stay under 1.75 keep doors.
export const monsterHeights = {
  goblin: 18,
  skeleton: 22,
  wolf: 18,
  troll: 34,
  bat: 16,
  boss: 34
}

const KINDS = Object.keys(monsterHeights)
// kind -> parts. Filled by a loaded sheet or, failing that, bakeMonster.
const cache = new Map()

export function monsterKinds() {
  return KINDS.slice()
}

function decodeFront(entry) {
  const raw = Uint8Array.from(atob(entry.b64), (char) => char.charCodeAt(0))
  const rgb = new Uint8Array(entry.w * entry.h * 3)
  const mask = new Uint8Array(entry.w * entry.h)
  for (let i = 0; i < mask.length; i++) {
    if (!raw[i * 4 + 3]) continue
    mask[i] = 1
    rgb[i * 3] = raw[i * 4]
    rgb[i * 3 + 1] = raw[i * 4 + 1]
    rgb[i * 3 + 2] = raw[i * 4 + 2]
  }
  return { rgb, mask, w: entry.w, h: entry.h }
}

function buildMonster(kind) {
  const entry = monsterFronts[kind]
  if (!entry) throw new Error(`no monster picture for ${kind}`)
  const parts = buildCard(decodeFront(entry), kind, monsterHeights[kind])
  const card = parts[0]
  card.rim = monsterRim(kind)
  card.paletteLock = true
  return parts
}

let palette = null

// The procedural card, palette-locked. The browser takes the same pixels from
// the PNGs script/bake_monsters.mjs writes, so this runs in node (models,
// tests, the bake) and in a browser only for a kind whose sheet has not
// arrived when it first spawns.
export function bakeMonster(kind) {
  if (!palette) palette = lockedPalette(styleHexes)
  const parts = buildMonster(kind)
  lockAtlas(parts[0], palette)
  return parts
}

export function monsterParts(kind) {
  const ready = cache.get(kind)
  if (ready) return ready
  const parts = bakeMonster(kind)
  cache.set(kind, parts)
  sources.set(kind, "baked")
  return parts
}

const sources = new Map()

// "sheet" when the kind came from its PNG, "baked" when it was built here.
export function monsterSource(kind) {
  return sources.get(kind) || null
}

export function monsterSheetUrl(kind) {
  return `/images/hd2d/monsters/${kind}.png`
}

// A loaded atlas becomes the kind's card. The card is the one bakeMonster
// builds, minus the unlocked front image that only the node models read.
export function adoptMonsterSheet(kind, atlas) {
  if (cache.has(kind)) return false
  const meta = monsterSheets[kind]
  if (!meta) throw new Error(`no monster sheet for ${kind}`)
  if (atlas.length !== meta.card.atlasW * meta.card.atlasH * 4) throw new Error(`monster sheet ${kind} size`)
  const card = { ...meta.card, atlas, rim: monsterRim(kind) }
  const parts = /** @type {any} */ ([card])
  parts.marks = meta.marks.slice()
  parts.voxelCount = meta.voxelCount
  parts.bounds = { ...meta.bounds }
  cache.set(kind, parts)
  sources.set(kind, "sheet")
  return true
}

async function decodeSheet(blob) {
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none" })
  const { width, height } = bitmap
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height })
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d", { willReadFrequently: true }))
  ctx.drawImage(bitmap, 0, 0)
  if (bitmap.close) bitmap.close()
  return new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer)
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

// Fetches each sheet in turn and yields between kinds, so no one task holds
// more than one decode. A sheet that fails leaves its kind to bakeMonster.
let loading = null

export function loadMonsterSheets(options) {
  if (options) return loadSheets(options)
  if (!loading) loading = loadSheets({})
  return loading
}

async function loadSheets(options) {
  const get = options.fetch || ((url) => fetch(url))
  const decode = options.decode || decodeSheet
  let adopted = 0
  for (const kind of KINDS) {
    if (cache.has(kind) || !monsterSheets[kind]) continue
    try {
      const response = await get(monsterSheetUrl(kind))
      if (!response.ok) throw new Error(`${response.status}`)
      const atlas = await decode(await response.blob())
      if (adoptMonsterSheet(kind, atlas)) adopted += 1
    } catch (err) {
      console.warn(`monster sheet ${kind}: ${err && err.message}`)
    }
    await nextTask()
  }
  return adopted
}

function lockAtlas(card, palette) {
  const count = card.atlasW * card.atlasH
  const rgb = new Uint8Array(count * 3)
  const mask = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    if (!card.atlas[o + 3]) continue
    mask[i] = 1
    rgb[i * 3] = card.atlas[o]
    rgb[i * 3 + 1] = card.atlas[o + 1]
    rgb[i * 3 + 2] = card.atlas[o + 2]
  }
  const locked = lockInk(rgb, card.atlasW, card.atlasH, mask, palette)
  for (let i = 0; i < count; i++) {
    if (!mask[i]) continue
    const o = i * 4
    card.atlas[o] = locked[i * 3]
    card.atlas[o + 1] = locked[i * 3 + 1]
    card.atlas[o + 2] = locked[i * 3 + 2]
  }
  card.atlasLocked = true
}
