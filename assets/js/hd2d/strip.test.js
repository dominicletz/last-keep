import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { cellOffset, sheetRow } from "../pictures.js"
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
  assert.equal(WALK_ROWS.length, 12)
  const cell = cellOffset(3, 2, 8, 12)
  assert.equal(cell.x, 3 / 8)
  assert.equal(cell.y, 1 - 3 / 12)
  assert.equal(cell.repeatX, 1 / 8)
  assert.equal(cell.repeatY, 1 / 12)
  const back = cellOffset(cell.x * 8, (1 - cell.y) * 12 - 1, 8, 12)
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

test("an idle warrior uses the rows after the walk", () => {
  const picture = { walk: 8, attack: 0, death: 0, idle: 4 }
  assert.equal(sheetRow(picture, {}, 0), 8)
  assert.equal(sheetRow(picture, {}, 320), 9)
  assert.equal(sheetRow(picture, {}, 960), 11)
  assert.equal(sheetRow(picture, { moving: true }, 160), 1)
  assert.equal(sheetRow({ walk: 4, attack: 3, death: 4 }, {}, 0), 0)
})

test("the committed walk sheet is the rasterizer rebuild", () => {
  const ran = spawnSync("python3", ["script/warrior_sheet.py", "--check"], { cwd: root, encoding: "utf8" })
  assert.equal(ran.status, 0, ran.stderr || ran.stdout)
  const committed = readWalkSheet(walkSheetPath(root))
  const committedNormal = readWalkSheet(walkNormalPath(root))
  assert.equal(committed.width, 64 * 8)
  assert.equal(committed.height, 64 * 12)
  assert.equal(committedNormal.width, committed.width)
  assert.equal(committedNormal.height, committed.height)
  for (let i = 3; i < committed.rgba.length; i += 4) {
    assert.equal(committed.rgba[i], committedNormal.rgba[i])
  }
})
