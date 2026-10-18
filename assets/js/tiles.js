import { grassTile, masonryTile } from "./tile-data.js"

function decode(b64) {
  const bytes = atob(b64)
  const rgb = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) rgb[i] = bytes.charCodeAt(i)
  return rgb
}

const grass = decode(grassTile.b64)
const masonry = decode(masonryTile.b64)

export function grassAt(ix, iy) {
  const x = ((ix % grassTile.w) + grassTile.w) % grassTile.w
  const y = ((iy % grassTile.h) + grassTile.h) % grassTile.h
  const offset = (y * grassTile.w + x) * 3
  return [grass[offset], grass[offset + 1], grass[offset + 2]]
}

export function masonryBytes() {
  const rgba = new Uint8Array(masonryTile.w * masonryTile.h * 4)
  for (let i = 0; i < masonry.length; i += 3) {
    const dest = (i / 3) * 4
    rgba[dest] = masonry[i]
    rgba[dest + 1] = masonry[i + 1]
    rgba[dest + 2] = masonry[i + 2]
    rgba[dest + 3] = 255
  }
  return { rgba, w: masonryTile.w, h: masonryTile.h }
}
