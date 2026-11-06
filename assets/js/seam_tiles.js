import { SHEET_TEXEL } from "./hd2d/picture.js"

// Passing seamless tiles (seamHolds: column wrap ≤ interior). Pine and the
// cliff face failed that gate and are not in this table.
export const GROUND_TILE_URLS = {
  yard: "/images/hd2d/ground-yard-grass.png",
  meadow: "/images/hd2d/ground-meadow.png",
  ruins: "/images/hd2d/ground-ruins.png"
}

const tiles = {}
let epoch = 0
const waiters = []

export function tileEpoch() {
  return epoch
}

export function onGroundTiles(fn) {
  waiters.push(fn)
  if (epoch) fn()
}

export function installGroundTiles(next) {
  for (const [name, tile] of Object.entries(next)) tiles[name] = tile
  epoch += 1
  for (const fn of waiters) fn()
}

export function sampleGroundTile(name, worldX, worldZ) {
  const tile = tiles[name]
  if (!tile) return null
  const px = Math.floor(worldX / SHEET_TEXEL)
  const pz = Math.floor(worldZ / SHEET_TEXEL)
  const x = ((px % tile.width) + tile.width) % tile.width
  const y = ((pz % tile.height) + tile.height) % tile.height
  const o = (y * tile.width + x) * 4
  return [tile.rgba[o], tile.rgba[o + 1], tile.rgba[o + 2]]
}

function paeth(left, up, corner) {
  const p = left + up - corner
  const pa = Math.abs(p - left)
  const pb = Math.abs(p - up)
  const pc = Math.abs(p - corner)
  if (pa <= pb && pa <= pc) return left
  return pb <= pc ? up : corner
}

function decodePng(buffer, inflateSync) {
  const bytes = buffer
  if (bytes[0] !== 137 || bytes.toString("ascii", 1, 4) !== "PNG") throw new Error("not a png")
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  const idat = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
      if (data[8] !== 8 || data[12] !== 0) throw new Error("png is not 8-bit and non-interlaced")
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : 3
  const pixels = new Uint8Array(width * height * channels)
  const stride = width * channels
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1)
    const filter = raw[row]
    if (filter > 4) throw new Error(`png filter ${filter}`)
    const out = y * stride
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[out + x - channels] : 0
      const up = y > 0 ? pixels[out - stride + x] : 0
      const corner = y > 0 && x >= channels ? pixels[out - stride + x - channels] : 0
      let guess = 0
      if (filter === 1) guess = left
      else if (filter === 2) guess = up
      else if (filter === 3) guess = (left + up) >> 1
      else if (filter === 4) guess = paeth(left, up, corner)
      pixels[out + x] = (raw[row + 1 + x] + guess) & 255
    }
  }
  const rgba = channels === 4 ? pixels : new Uint8Array(width * height * 4)
  if (channels === 3) {
    for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
      rgba[j] = pixels[i]
      rgba[j + 1] = pixels[i + 1]
      rgba[j + 2] = pixels[i + 2]
      rgba[j + 3] = 255
    }
  }
  return { rgba, width, height }
}

function loadNodeTiles() {
  const proc = globalThis.process
  if (!proc?.getBuiltinModule) return
  const fs = proc.getBuiltinModule("fs")
  const path = proc.getBuiltinModule("path")
  const url = proc.getBuiltinModule("url")
  const zlib = proc.getBuiltinModule("zlib")
  const here = path.dirname(url.fileURLToPath(import.meta.url))
  const root = path.resolve(here, "../..")
  const next = {}
  for (const [name, rel] of Object.entries(GROUND_TILE_URLS)) {
    next[name] = decodePng(fs.readFileSync(path.join(root, "priv/static", rel.slice(1))), zlib.inflateSync)
  }
  installGroundTiles(next)
}

loadNodeTiles()

export function loadGroundTilesInBrowser() {
  if (typeof document === "undefined" || epoch) return
  const jobs = Object.entries(GROUND_TILE_URLS).map(([name, src]) => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      resolve([name, { rgba: ctx.getImageData(0, 0, img.width, img.height).data, width: img.width, height: img.height }])
    }
    img.onerror = () => reject(new Error(src))
    img.src = src
  }))
  Promise.all(jobs).then((pairs) => installGroundTiles(Object.fromEntries(pairs)))
}
