import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const plates = path.join(root, "assets/reference/warrior")

function pngSize(bytes) {
  assert.equal(bytes[0], 137)
  assert.equal(bytes.toString("ascii", 1, 4), "PNG")
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR")
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function jpegSize(bytes) {
  assert.equal(bytes[0], 0xff)
  assert.equal(bytes[1], 0xd8)
  let i = 2
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = bytes[i + 1]
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    const length = bytes.readUInt16BE(i + 2)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) }
    }
    if (marker === 0xda) break
    i += 2 + length
  }
  throw new Error("jpeg size")
}

test("warrior reference plates stay committed", () => {
  const concept = pngSize(fs.readFileSync(path.join(plates, "concept.png")))
  const turnaround = jpegSize(fs.readFileSync(path.join(plates, "turnaround.jpg")))
  const walk = jpegSize(fs.readFileSync(path.join(plates, "walk-reference.jpg")))
  assert.deepEqual(concept, { width: 640, height: 400 })
  assert.deepEqual(turnaround, { width: 1280, height: 720 })
  assert.deepEqual(walk, { width: 1280, height: 720 })
})
