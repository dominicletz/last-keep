// Pure deterministic biome lookup mirroring LastKeep.Game.World (phash2 + cell bands).
// Kept free of Three.js so pure HUD and client helpers can check biomes directly.

const CELL = 36
const CHUNK = 512
const RADIUS = 7200
const KEEP = 400
const HCONST = 0x9e3779b9
const HCONST_9 = 0x8ff34781

// Erlang round is half away from zero. Math.round sends -0.5 to 0.
export function roundAway(q) {
  if (!Number.isFinite(q)) return 0
  return q >= 0 ? Math.round(q) : -Math.round(-q)
}

function u32(n) {
  return n >>> 0
}

function mix(a, b, c) {
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 13))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 8))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 13))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 12))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 16))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 5))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 3))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 10))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 15))
  return c
}

function uintHash(value, hash, prime) {
  const a = u32(prime + u32(value))
  const b = u32(prime)
  return mix(a, b, hash)
}

// A negative small is mixed twice. The second mix uses the two's-complement bits.
function sintHash(value, hash) {
  const y = value | 0
  if (y < 0) hash = uintHash((-y) >>> 0, hash, HCONST)
  return uintHash(y >>> 0, hash, HCONST)
}

export function phash2(values) {
  let hash = uintHash(values.length, 0, HCONST_9)
  for (const value of values) hash = sintHash(value, hash)
  return hash & 0x07ffffff
}

function inside(i, j) {
  const x = i * CELL
  const y = j * CELL
  const cx = Math.floor(x / CHUNK)
  const cy = Math.floor(y / CHUNK)
  if (cx < -14 || cx > 14 || cy < -14 || cy > 14) return false
  return x * x + y * y <= RADIUS * RADIUS
}

function discBiome(seed, attempt, i, j) {
  const x = i * CELL
  const y = j * CELL
  if (x * x + y * y <= KEEP * KEEP) return "meadow"
  const hash = phash2([seed, i, j, attempt])
  const band = hash % 100
  if (band <= 7 && hash % 5 === 0) return "ford"
  if (band <= 7) return "river"
  if (band <= 13) return "cliff"
  if (band <= 39) return "pine"
  if (band <= 51) return "ruins"
  return "meadow"
}

function skirtBiome(seed, attempt, i, j) {
  const band = phash2([seed, i, j, attempt]) % 100
  if (band <= 40) return "pine"
  if (band <= 70) return "cliff"
  if (band <= 88) return "hill"
  return "mountain"
}

export function pictureCell(seed, attempt, x, y) {
  const i = roundAway(x / CELL)
  const j = roundAway(y / CELL)
  if (inside(i, j)) return discBiome(seed, attempt, i, j)
  return skirtBiome(seed, attempt, i, j)
}
