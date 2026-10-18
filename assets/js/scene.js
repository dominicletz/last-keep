// theme.jpg medians. Sky is the blue-violet dusk at 24,0. Ground is the lit
// clearing grass at 366,314, not the shadow moss. The horizon is the orange
// band. Moss is the brightest hue-85 patch, at 150,192. Do not fill the sky
// with a brick, and do not leave the field olive.
export const skyColor = 0x4e4651
export const horizonColor = 0xeba15d
export const sunsetColor = 0xe58e54
export const groundColor = 0x5c642f
export const pathColor = 0x5e4529
export const plazaColor = groundColor
export const ringColor = 0x4b3c33
export const plazaSides = 48
export const flameColor = 0xeea821
export const mossColor = 0x455c28
export const mossRegion = { x: 150, y: 192, w: 4, h: 4 }

// Daylight stays near the material color. The old sun (amber at 2.6, plus a warm
// ambient past 1) clipped every grey to orange, so plate and stone read as brown.
// The sun sits at the same offset the renderer uses, so the lit-ground check
// matches the yard.
const SUN_DIR = normalize([90, 200, 30])
export const sunDot = SUN_DIR[1]

export const yardLight = {
  sky: 0xc8c6c2,
  ground: 0x5c642f,
  hemisphere: 0.55,
  // Grass lifted toward white. The warm grey illuminant left the clearing olive.
  ambient: 0xd4e0d6,
  ambientLevel: 4.5,
  sun: 0xfff3e4,
  sunLevel: 0.22,
  torch: 8
}

// The build is day. The last eight seconds of the build are dusk. A wave is night.
// Day bodies stay on yardLight so grey plate is not clipped. The ground fill is
// a separate lamp: green by day, violet by dusk. It does not light heroes.
// Dusk bodies are the cool violet. Warmth is the brazier pool, not the sky.
export const cycleLight = {
  day: {
    ...yardLight,
    groundFill: 0x40ff60,
    groundFillLevel: 2.2,
    pool: 0,
    background: skyColor
  },
  dusk: {
    sky: 0x6a5080,
    ground: 0x3a3050,
    hemisphere: 0.45,
    ambient: 0x9a90b8,
    ambientLevel: 1.6,
    sun: 0x9a90c0,
    sunLevel: 0.25,
    groundFill: 0x8060ff,
    groundFillLevel: 10,
    torch: 26,
    pool: 5200,
    background: skyColor
  },
  night: {
    sky: 0x4e4651,
    ground: 0x2a221c,
    hemisphere: 0.28,
    ambient: 0xd0c8dc,
    ambientLevel: 1.15,
    sun: 0xc8b8d0,
    sunLevel: 0.22,
    torch: 34,
    pool: 6400,
    background: 0x322c3c
  }
}

export function lightName(snap) {
  if (!snap) return "day"
  if (snap.phase === "wave" || snap.phase === "over" || snap.enraged) return "night"
  if (snap.hold) return "day"
  if (snap.phase === "build") {
    const ms = Number(snap.phase_ms)
    if (Number.isFinite(ms) && ms > 0 && ms <= 8000) return "dusk"
    return "day"
  }
  return "day"
}

export function lightLevel(name) {
  const rig = cycleLight[name] || cycleLight.day
  return rig.hemisphere + rig.ambientLevel + rig.sunLevel
}

export function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function hueOf(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  if (span < 1e-6) return 0
  let hue
  if (max === r) hue = ((g - b) / span) % 6
  else if (max === g) hue = (b - r) / span + 2
  else hue = (r - g) / span + 4
  return (hue * 60 + 360) % 360
}

export function patchStats(rgba) {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < rgba.length; i += 4) {
    r += rgba[i]
    g += rgba[i + 1]
    b += rgba[i + 2]
    count += 1
  }
  r /= count
  g /= count
  b /= count
  let variance = 0
  for (let i = 0; i < rgba.length; i += 4) {
    variance += (rgba[i] - r) ** 2 + (rgba[i + 1] - g) ** 2 + (rgba[i + 2] - b) ** 2
  }
  return { r, g, b, luma: lumaOf(r, g, b), hue: hueOf(r, g, b), variance: variance / count }
}

export function hueGap(left, right) {
  const gap = Math.abs(left - right) % 360
  return Math.min(gap, 360 - gap)
}

// Up-facing MeshLambert. Three encodes the paint and the lights as sRGB and
// the BRDF divides by pi. litGround is the body light. litYard adds the ground
// fill, which is the lamp that does not touch heroes. litPool adds the brazier.
function shade(albedo, terms) {
  const bytes = [16, 8, 0].map((shift) => {
    const paint = srgbToLinear(((albedo >> shift) & 255) / 255)
    let sum = 0
    for (const term of terms) {
      const channel = srgbToLinear(((term.color >> shift) & 255) / 255)
      sum += channel * term.level * (term.sun ? sunDot : 1)
    }
    const linear = Math.min(1, (paint * sum) / Math.PI)
    return Math.round(linearToSrgb(linear) * 255)
  })
  return {
    r: bytes[0],
    g: bytes[1],
    b: bytes[2],
    luma: lumaOf(bytes[0], bytes[1], bytes[2]),
    hue: hueOf(bytes[0], bytes[1], bytes[2])
  }
}

function bodyTerms(rig) {
  return [
    { color: rig.sky, level: rig.hemisphere },
    { color: rig.ambient, level: rig.ambientLevel },
    { color: rig.sun, level: rig.sunLevel, sun: true }
  ]
}

export function litGround(albedo, rig) {
  return shade(albedo, bodyTerms(rig))
}

export function litYard(albedo, rig) {
  const terms = bodyTerms(rig)
  if (rig.groundFill && rig.groundFillLevel) {
    terms.push({ color: rig.groundFill, level: rig.groundFillLevel })
  }
  return shade(albedo, terms)
}

export function litPool(albedo, rig, warmth) {
  const terms = bodyTerms(rig)
  if (rig.groundFill && rig.groundFillLevel) {
    terms.push({ color: rig.groundFill, level: rig.groundFillLevel })
  }
  terms.push({ color: flameColor, level: warmth })
  return shade(albedo, terms)
}

// A small in-game dusk frame: violet sky, the cool field, and the torch pool.
export function duskFrame(ground, rig = cycleLight.dusk, width = 96, height = 60) {
  const sky = bytesOf(rig.background)
  const field = litYard(ground, rig)
  const pool = litPool(ground, rig, 4)
  const torch = Math.min(1, (Number(rig.torch) || 0) / 20)
  const flame = bytesOf(flameColor).map((channel) => Math.round(channel * torch))
  const rgb = new Uint8Array(width * height * 3)
  const horizon = Math.floor(height * 0.38)
  for (let y = 0; y < height; y++) {
    const row = y < horizon ? sky : [field.r, field.g, field.b]
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3
      rgb[offset] = row[0]
      rgb[offset + 1] = row[1]
      rgb[offset + 2] = row[2]
    }
  }
  const cx = Math.floor(width * 0.62)
  const cy = Math.floor(height * 0.58)
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > 10) continue
      const offset = (y * width + x) * 3
      rgb[offset] = flame[0]
      rgb[offset + 1] = flame[1]
      rgb[offset + 2] = flame[2]
    }
  }
  let max = 0
  const count = width * height
  for (let i = 0; i < count; i++) {
    max = Math.max(max, lumaOf(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]))
  }
  return {
    r: field.r,
    g: field.g,
    b: field.b,
    luma: field.luma,
    hue: field.hue,
    poolHue: pool.hue,
    poolLuma: pool.luma,
    max
  }
}

function bytesOf(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(channel) {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1
  return vector.map((value) => value / length)
}
