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

function rgbaTile(name, phase) {
  const tile = phaseTiles[phase][name]
  const bytes = decoded[phase][name]
  const rgba = new Uint8Array(tile.w * tile.h * 4)
  for (let i = 0; i < bytes.length; i += 3) {
    const dest = (i / 3) * 4
    rgba[dest] = bytes[i]
    rgba[dest + 1] = bytes[i + 1]
    rgba[dest + 2] = bytes[i + 2]
    rgba[dest + 3] = 255
  }
  return { rgba, w: tile.w, h: tile.h }
}

export function masonryBytes(phase) {
  return rgbaTile("masonry", phase)
}

export function propBytes(name, phase) {
  return rgbaTile(name, phase)
}
