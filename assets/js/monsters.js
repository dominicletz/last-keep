import { monsterFronts } from "./monster-data.js"
import { buildCard } from "./pictures.js"

// World height of the crop card. Goblins, skeletons, wolves, and bats stay
// under the hero. The troll and the rider stay under 1.75 keep doors.
export const monsterHeights = {
  goblin: 18,
  skeleton: 22,
  wolf: 16,
  troll: 34,
  bat: 10,
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

export function monsterParts(kind) {
  if (cache.has(kind)) return cache.get(kind)
  const entry = monsterFronts[kind]
  if (!entry) throw new Error(`no monster picture for ${kind}`)
  const parts = buildCard(decodeFront(entry), kind, monsterHeights[kind])
  cache.set(kind, parts)
  return parts
}
