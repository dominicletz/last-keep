// Grass, path, pine shade, and the sunset band. Hexes are the STYLE.md tokens.
// The plane covers the camera, not the whole 1900 map, so a texel stays
// bigger than a flat wash.
export const GROUND_TEX = 128
export const GROUND_SPAN = 760

const GRASS = [0x5c, 0x64, 0x2f]
const TUFT = [0x3a, 0x42, 0x18]
const LIGHT = [0x6e, 0x7a, 0x38]
const PATH = [0x5e, 0x45, 0x29]
const SHADE = [0x2c, 0x34, 0x16]
const SUNSET = [0xe5, 0x8e, 0x54]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return h / 4294967296
}

export function groundPixels(phase, size = GROUND_TEX, span = GROUND_SPAN) {
  const rgba = new Uint8Array(size * size * 4)
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const u = (ix + 0.5) / size
      const v = (iy + 0.5) / size
      const worldX = (u - 0.5) * span
      const worldZ = -(v - 0.5) * span
      const radius = Math.hypot(worldX, worldZ)
      const clump = hash(ix >> 1, iy >> 1)
      const grain = hash(ix, iy)
      let color = GRASS
      if (clump < 0.28) color = TUFT
      else if (clump > 0.8) color = LIGHT
      if (grain < 0.16) color = SHADE
      else if (grain > 0.9) color = LIGHT
      if (phase === "night" && grain < 0.22) color = [0x12, 0x16, 0x0c]
      else if (phase === "night" && grain > 0.78) color = [0x8a, 0x96, 0x44]
      if (radius > 230 && radius < 290) color = mix(color, SHADE, 0.65)
      if (Math.abs(worldX) < 16 || Math.abs(worldZ) < 16) color = mix(PATH, color, radius > 170 ? 0.35 : 0)
      if (radius > 270) {
        const edge = Math.min(1, (radius - 270) / 90)
        if (phase === "dusk") color = mix(color, SUNSET, 0.35 + edge * 0.65)
        else if (phase === "night") color = mix(color, SHADE, 0.45 + edge * 0.4)
        else color = mix(color, SHADE, 0.25 + edge * 0.35)
      }
      const offset = (iy * size + ix) * 4
      rgba[offset] = color[0]
      rgba[offset + 1] = color[1]
      rgba[offset + 2] = color[2]
      rgba[offset + 3] = 255
    }
  }
  return rgba
}
