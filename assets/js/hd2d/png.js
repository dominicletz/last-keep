import { deflateSync, inflateSync } from "node:zlib"

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

function encode(raw, width, height, colorType) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))])
}

function decode(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
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
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : 3
  if (raw[0] !== undefined && raw.length < height * (width * channels + 1)) throw new Error("png short")
  const pixels = new Uint8Array(width * height * channels)
  const stride = width * channels
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1)
    if (raw[row] !== 0) throw new Error("png filter is not 0")
    pixels.set(raw.subarray(row + 1, row + 1 + stride), y * stride)
  }
  return { pixels, width, height, channels }
}

export function writeRgbaPng(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1)
  }
  return encode(raw, width, height, 6)
}

export function writeRgbPng(rgba, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1)
    raw[row] = 0
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4
      const d = row + 1 + x * 3
      raw[d] = rgba[s]
      raw[d + 1] = rgba[s + 1]
      raw[d + 2] = rgba[s + 2]
    }
  }
  return encode(raw, width, height, 2)
}

export function readRgbaPng(buffer) {
  const decoded = decode(buffer)
  if (decoded.channels !== 4) throw new Error("png is not rgba")
  return { rgba: decoded.pixels, width: decoded.width, height: decoded.height }
}

export function readRgbPng(buffer) {
  const decoded = decode(buffer)
  if (decoded.channels !== 3) throw new Error("png is not rgb")
  return { rgb: decoded.pixels, width: decoded.width, height: decoded.height }
}
