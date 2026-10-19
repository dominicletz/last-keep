import { phaseTiles } from "./tile-data.js"

function decode(b64) {
  const bytes = atob(b64)
  const rgb = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) rgb[i] = bytes.charCodeAt(i)
  return rgb
}

const decoded = Object.fromEntries(
  Object.entries(phaseTiles).map(([phase, tiles]) => [
    phase,
    Object.fromEntries(Object.entries(tiles).map(([name, tile]) => [name, decode(tile.b64)]))
  ])
)
const grass = Object.fromEntries(Object.entries(decoded).map(([phase, tiles]) => [phase, tiles.grass]))

export function grassAt(ix, iy, phase) {
  const tile = phaseTiles[phase].grass
  const bytes = grass[phase]
  const x = ((ix % tile.w) + tile.w) % tile.w
  const y = ((iy % tile.h) + tile.h) % tile.h
  const offset = (y * tile.w + x) * 3
  return [bytes[offset], bytes[offset + 1], bytes[offset + 2]]
}

// The tree and the felled wood are full crops. A solid rectangle of either one
// covers the keep's screen box and pulls the yard's focal gap under 5.
// The cut keeps the sheet pixels and drops the rectangle around the figure.
export function figureAlpha(name, x, y, width, height) {
  const u = width <= 1 ? 0.5 : x / (width - 1)
  const v = height <= 1 ? 0.5 : y / (height - 1)
  const cx = Math.abs(u - 0.5)
  if (name === "tree") {
    const trunk = v >= 0.7 && cx <= 0.07
    const tier = (top, bottom, waist) => {
      if (v < top || v > bottom) return false
      const t = (v - top) / (bottom - top)
      return cx <= waist + t * (0.46 - waist)
    }
    return trunk || tier(0, 0.28, 0.02) || tier(0.16, 0.48, 0.08) || tier(0.34, 0.74, 0.12) ? 255 : 0
  }
  if (name === "scenery") {
    const col = Math.min(4, Math.floor(u * 5))
    const within = u * 5 - col
    return v >= 0.12 && v <= 0.94 && within >= 0.22 && within <= 0.78 ? 255 : 0
  }
  return 255
}

function rgbaTile(name, phase) {
  const tile = phaseTiles[phase][name]
  const bytes = decoded[phase][name]
  const rgba = new Uint8Array(tile.w * tile.h * 4)
  for (let y = 0; y < tile.h; y++) {
    for (let x = 0; x < tile.w; x++) {
      const i = y * tile.w + x
      const dest = i * 4
      let r = bytes[i * 3]
      let g = bytes[i * 3 + 1]
      let b = bytes[i * 3 + 2]
      // A near-black pine against the dusk ground pushes the yard noise over 12.
      // 62% of the crown moves to the pine token so the edge step stays near that ground.
      if (phase === "dusk" && name === "tree") {
        r = Math.round(r * 0.38 + 0x35 * 0.62)
        g = Math.round(g * 0.38 + 0x3e * 0.62)
        b = Math.round(b * 0.38 + 0x27 * 0.62)
      }
      rgba[dest] = r
      rgba[dest + 1] = g
      rgba[dest + 2] = b
      rgba[dest + 3] = figureAlpha(name, x, y, tile.w, tile.h)
    }
  }
  return { rgba, w: tile.w, h: tile.h }
}

export function masonryBytes(phase) {
  return rgbaTile("masonry", phase)
}

export function propBytes(name, phase) {
  return rgbaTile(name, phase)
}
