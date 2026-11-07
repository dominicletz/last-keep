// The locked monster atlases as palette PNGs. The browser used to build and
// palette-lock every atlas while the bundle loaded, about 1.6s of main thread
// before the first menu frame. script/bake_monsters.mjs writes the same
// pixels to priv/static/images/hd2d/monsters, and monsters.js loads them.
// Node only: this file uses node:zlib.
import { deflateSync, inflateSync } from "node:zlib"

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

let crcTable = null

function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

// Index 0 is the clear pixel. Alpha is 0 or 255 in a locked atlas, so a
// palette with one transparent entry holds every pixel exactly.
export function writeAtlasPng(atlas, width, height) {
  const colors = new Map()
  const rgb = [0, 0, 0]
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      let index = 0
      if (atlas[o + 3] === 255) {
        const key = (atlas[o] << 16) | (atlas[o + 1] << 8) | atlas[o + 2]
        index = colors.get(key)
        if (index === undefined) {
          index = colors.size + 1
          if (index > 255) throw new Error("a locked atlas has more than 255 colors")
          colors.set(key, index)
          rgb.push(atlas[o], atlas[o + 1], atlas[o + 2])
        }
      } else if (atlas[o + 3] !== 0 || atlas[o] || atlas[o + 1] || atlas[o + 2]) {
        throw new Error("a locked atlas pixel is clear black or opaque")
      }
      raw[y * (width + 1) + 1 + x] = index
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 3
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("PLTE", Buffer.from(rgb)),
    chunk("tRNS", Buffer.from([0])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ])
}

export function readAtlasPng(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!bytes.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a png")
  let offset = 8
  let width = 0
  let height = 0
  let palette = null
  let clear = Buffer.alloc(0)
  const idat = []
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString("ascii", offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 3) throw new Error("not an 8-bit palette png")
    } else if (type === "PLTE") palette = data
    else if (type === "tRNS") clear = data
    else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const atlas = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    if (raw[y * (width + 1)] !== 0) throw new Error("png filter is not 0")
    for (let x = 0; x < width; x++) {
      const index = raw[y * (width + 1) + 1 + x]
      const alpha = index < clear.length ? clear[index] : 255
      if (!alpha) continue
      const o = (y * width + x) * 4
      atlas[o] = palette[index * 3]
      atlas[o + 1] = palette[index * 3 + 1]
      atlas[o + 2] = palette[index * 3 + 2]
      atlas[o + 3] = alpha
    }
  }
  return { atlas, width, height }
}

// What monsters.js needs to rebuild a card around a loaded atlas.
export function sheetMeta(parts) {
  const card = parts[0]
  const { image: _image, atlas: _atlas, rim: _rim, ...rest } = card
  return { card: rest, marks: parts.marks, voxelCount: parts.voxelCount, bounds: parts.bounds }
}
