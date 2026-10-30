import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { cellOffset } from "../pictures.js"
import {
  WALK_COLUMNS,
  WALK_NORMAL,
  WALK_ROWS,
  WALK_SHEET,
  cleanCell,
  conceptPaint,
  paintWalkStrip,
  readWalkSheet,
  walkNormalPath,
  walkSheetPath
} from "./strip.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

test("the walk sheet url is the new warrior strip", () => {
  assert.equal(WALK_SHEET, "images/hd2d/warrior-walk.png")
  assert.equal(WALK_NORMAL, "images/hd2d/warrior-walk-normal.png")
  assert.equal(WALK_COLUMNS.length, 8)
  assert.equal(WALK_ROWS.length, 4)
  const cell = cellOffset(3, 2, 8, 4)
  assert.equal(cell.x, 3 / 8)
  assert.equal(cell.y, 1 - 3 / 4)
  assert.equal(cell.repeatX, 1 / 8)
  assert.equal(cell.repeatY, 1 / 4)
  const back = cellOffset(cell.x * 8, (1 - cell.y) * 4 - 1, 8, 4)
  assert.equal(back.x, cell.x)
  assert.equal(back.y, cell.y)
})

test("hero-data.js is unchanged", () => {
  const bytes = fs.readFileSync(path.join(root, "assets/js/hero-data.js"))
  const hash = crypto.createHash("sha256").update(bytes).digest("hex")
  assert.equal(hash, "90737c85439354c4c5601e75c6fe9691bda71f25de310dbc450080a379665b7a")
})

test("paint is required and a proxy cell is refused", async () => {
  await assert.rejects(() => paintWalkStrip({}), /paint is required/)
  const w = 8
  const h = 12
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 2; x < 6; x++) {
      const o = (y * w + x) * 4
      rgba[o] = 181
      rgba[o + 1] = 175
      rgba[o + 2] = 170
      rgba[o + 3] = 255
    }
  }
  const guide = { column: 1, frame: 1, cellW: w, cellH: h, key: rgba, proxy: rgba }
  assert.throws(() => cleanCell({ rgba, w, h }, guide), /proxy/)
  const other = new Uint8Array(rgba)
  other[(2 * w + 2) * 4] = 9
  assert.throws(() => cleanCell({ rgba: other, w, h }, { ...guide, column: 1, key: other, proxy: rgba }), /key/)
})

test("the committed walk sheet is the concept paint plus a normal map", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "walk-"))
  const file = path.join(dir, "warrior-walk.png")
  const painted = await paintWalkStrip({
    file,
    paint(guide) {
      return conceptPaint(guide)
    }
  })
  assert.equal(painted.width, 77 * 8)
  assert.equal(painted.height, 160 * 4)
  const fresh = readWalkSheet(file)
  const normal = readWalkSheet(file.replace(/\.png$/, "-normal.png"))
  assert.equal(fresh.width, painted.width)
  assert.equal(normal.width, fresh.width)
  assert.equal(normal.height, fresh.height)
  const committed = readWalkSheet(walkSheetPath(root))
  const committedNormal = readWalkSheet(walkNormalPath(root))
  assert.equal(committed.width, fresh.width)
  assert.equal(committed.height, fresh.height)
  assert.equal(committedNormal.width, committed.width)
  assert.equal(committedNormal.height, committed.height)
  assert.equal(Buffer.compare(committed.rgba, fresh.rgba), 0)
  const y = 80
  const stride = committed.width * 4
  const row = 77 * 4
  const front = committed.rgba.subarray(y * stride, y * stride + row)
  const side = committed.rgba.subarray(y * stride + 2 * 77 * 4, y * stride + 2 * 77 * 4 + row)
  assert.notEqual(Buffer.compare(front, side), 0)
})
