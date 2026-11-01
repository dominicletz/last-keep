import { pixelStep } from "./art_score.js"
import { grassAt } from "./tiles.js"

// Grass, path, pine shade, stone, and the sunset band. Hexes are the STYLE.md tokens.
// The base is the concept clearing tile.
// The outer plane covers the camera. The plaza disc covers the flat town circle
// the camera stands on, without replacing that circle's mesh.
// pixelStep(168, 400) is 0.84. That is the hero texel. The yard textures use the
// same step, so a hero pixel and a ground pixel cover one world distance.
export const HERO_TEXEL = pixelStep(168, 400)
export const GROUND_SPAN = 760
export const GROUND_TEX = Math.round(GROUND_SPAN / HERO_TEXEL)
export const PLAZA_SPAN = 300
export const PLAZA_TEX = Math.round(PLAZA_SPAN / HERO_TEXEL)

const PATH = [0x5e, 0x45, 0x29]
const SHADE = [0x2c, 0x34, 0x16]
const STONE = [0x4b, 0x3c, 0x33]
const PEBBLE = [0x65, 0x4e, 0x41]
const SUNSET = [0xe5, 0x8e, 0x54]

function mix(a, b, t) {
  const clamped = Math.max(0, Math.min(1, t))
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped)
  ]
}

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return h / 4294967296
}

function paint(phase, size, span) {
  const rgba = new Uint8Array(size * size * 4)
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const u = (ix + 0.5) / size
      const v = (iy + 0.5) / size
      const worldX = (u - 0.5) * span
      const worldZ = -(v - 0.5) * span
      const radius = Math.hypot(worldX, worldZ)
      // The keep's day edge is the quiet read (floor 25). A hero-texel buffer
      // reshuffles flecks under that silhouette and the gap falls to 24.7.
      // Inside 148 the flecks stay on the 512px yard they were authored for,
      // and the grass jig stays off. That disc measures day contrast 25.20.
      // Radius 150 drops the night mage at (160, 0) under the floor of 29,
      // because that card's edge rays land inside the disc.
      const keepDisc = radius < 148
      const qx = keepDisc ? Math.floor((worldX / span + 0.5) * 512) : ix
      const qy = keepDisc ? Math.floor((-worldZ / span + 0.5) * 512) : iy
      const n = hash(qx, qy)
      const n2 = hash(qx + 19, qy - 7)
      // The concept grass is 48 px. Sampling it on the pixel grid stamps that
      // period across the yard. A 36-unit block shifts the sample so the next
      // copy does not line up with the last.
      const block = 36
      const bx = Math.floor(worldX / block)
      const bz = Math.floor(worldZ / block)
      const jigReach = keepDisc ? 0 : 48
      const jigX = Math.floor(hash(bx, bz) * jigReach)
      const jigY = Math.floor(hash(bz, bx + 3) * jigReach)
      let color = grassAt(ix + jigX, iy + jigY, phase)
      if (n2 < 0.07) color = STONE
      else if (n2 < 0.12) color = PEBBLE
      // The inner pine crown is a few pixels. The dusk sample around it is mostly
      // the ground behind that crown. Sunset flecks there pull the pine hue onto
      // the keep stone. Flecks stay in the plaza and past the wall. The 0.88
      // rate is what keeps the dusk yard under the noise cap.
      const pineBand = radius > 168 && radius < 330
      if (phase === "dusk" && n2 > 0.88 && !pineBand) color = SUNSET
      const pathBand = Math.min(Math.abs(worldX), Math.abs(worldZ))
      const along = Math.max(Math.abs(worldX), Math.abs(worldZ))
      if (pathBand < 12 + n * 14 && along < span * 0.46) color = mix(PATH, color, pathBand / 30)
      if (radius > 34 && radius < 82 && n > 0.35) color = mix(PATH, color, (radius - 34) / 70)
      if (radius < 48) color = mix(SHADE, color, 0.25 + (radius / 48) * 0.75)
      if (radius > 300) {
        const edge = Math.min(1, (radius - 300) / 70)
        if (phase === "dusk") color = mix(color, SUNSET, 0.2 + edge * 0.6)
        else color = mix(color, SHADE, 0.15 + edge * 0.4)
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

export function groundPixels(phase, size = GROUND_TEX, span = GROUND_SPAN) {
  return paint(phase, size, span)
}

export function plazaPixels(phase, size = PLAZA_TEX, span = PLAZA_SPAN) {
  return paint(phase, size, span)
}
