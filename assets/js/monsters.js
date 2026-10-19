import { lockInk, lockedPalette, styleHexes } from "./art_score.js"
import { monsterRim } from "./bodies.js"
import { monsterFronts } from "./monster-data.js"
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

// The sheet lock is done once, when this module loads, not when a kind first spawns.
function prepareMonsterPictures() {
  const palette = lockedPalette(styleHexes)
  for (const kind of KINDS) {
    const parts = buildMonster(kind)
    lockAtlas(parts[0], palette)
    cache.set(kind, parts)
  }
}

export function monsterParts(kind) {
  const ready = cache.get(kind)
  if (ready) return ready
  const parts = buildMonster(kind)
  cache.set(kind, parts)
  return parts
}

prepareMonsterPictures()

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
