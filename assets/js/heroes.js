import { heroFronts } from "./hero-data.js"
import { buildCard } from "./pictures.js"

const HEROES = ["warrior", "mage", "scout", "farmer", "engineer"]

export function heroKinds() {
  return HEROES.slice()
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

const heroCache = new Map()

export function heroParts(kind) {
  if (heroCache.has(kind)) return heroCache.get(kind)
  const entry = heroFronts[kind]
  if (!entry) throw new Error(`no hero picture for ${kind}`)
  const parts = buildCard(decodeFront(entry), kind)
  heroCache.set(kind, parts)
  return parts
}

export function heroSignature(kind) {
  const parts = heroParts(kind)
  return {
    kind,
    parts,
    marks: parts.marks.slice(),
    bounds: parts.bounds
  }
}
