import { grassAt, propBytes } from "./tiles.js"

// Grass, path, pine shade, stone, and the sunset band. Hexes are the STYLE.md tokens.
// The base is the concept clearing tile.
// The outer plane covers the camera. The plaza disc covers the flat town circle
// the camera stands on, without replacing that circle's mesh.
export const GROUND_TEX = 512
export const GROUND_SPAN = 760
export const PLAZA_TEX = 256
export const PLAZA_SPAN = 300

const PATH = [0x5e, 0x45, 0x29]
const PINE = [0x35, 0x3e, 0x27]
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
  const street = propBytes("path", phase)
  for (let iy = 0; iy < size; iy++) {
    for (let ix = 0; ix < size; ix++) {
      const u = (ix + 0.5) / size
      const v = (iy + 0.5) / size
      const worldX = (u - 0.5) * span
      const worldZ = -(v - 0.5) * span
      const radius = Math.hypot(worldX, worldZ)
      const n = hash(ix, iy)
      const n2 = hash(ix + 19, iy - 7)
      let color = grassAt(ix, iy, phase)
      if (n2 < 0.07) color = STONE
      else if (n2 < 0.12) color = PEBBLE
      // The inner pine crown is a few pixels. The dusk sample around it is mostly
      // the ground behind that crown. Sunset flecks there pull the pine hue onto
      // the keep stone. Flecks stay in the plaza and past the wall. The 0.88
      // rate is what keeps the dusk yard under the noise cap.
      const pineBand = radius > 168 && radius < 330
      if (phase === "dusk" && n2 > 0.88 && !pineBand) color = SUNSET
      // The painted forest floor is the pine token. The clearing grass stays inside the wall.
      if (pineBand) color = mix(color, PINE, 0.55)
      const pathBand = Math.min(Math.abs(worldX), Math.abs(worldZ))
      const along = Math.max(Math.abs(worldX), Math.abs(worldZ))
      // The painted street is the path crop, wider than a single hero.
      if (pathBand < 22 + n * 8 && along < span * 0.46) {
        const tx = ((ix % street.w) + street.w) % street.w
        const ty = ((iy % street.h) + street.h) % street.h
        const po = (ty * street.w + tx) * 4
        const painted = [street.rgba[po], street.rgba[po + 1], street.rgba[po + 2]]
        color = mix(painted, color, pathBand / 36)
      }
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
