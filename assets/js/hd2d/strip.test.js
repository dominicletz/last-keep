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

const CELL = 64
const DIRS = 8
const WALK = 8
const ROWS = 12
const FILL = Math.round(32 / 0.84)
const OUTLINE = "24,24,24"
const BANDS = {
  plate: ["232,228,224", "181,175,170", "112,108,104"],
  helmet: ["90,96,104", "58,64,72", "32,36,42"],
  cape: ["176,48,42", "122,28,28", "72,16,18"],
  shield: ["92,122,158", "56,81,111", "32,48,70"],
  gold: ["240,206,110", "196,154,64", "128,96,32"],
  skin: ["214,164,128", "176,124,96", "120,80,64"],
  beard: ["92,64,44", "62,42,30", "36,24,18"],
  sword: ["210,214,216", "150,156,160", "78,84,90"],
  belt: ["120,78,42", "78,50,28", "46,30,18"],
  boot: ["72,52,36", "48,34,24", "28,20,14"]
}
const PALETTE = new Set([OUTLINE, ...Object.values(BANDS).flat()])
const SKIN = new Set(BANDS.skin)
const CAPE = new Set(BANDS.cape)
const SHIELD = new Set(BANDS.shield)
const BOOT = new Set(BANDS.boot)

function cellAt(rgba, width, column, row) {
  const out = new Uint8Array(CELL * CELL * 4)
  for (let y = 0; y < CELL; y++) {
    const src = ((row * CELL + y) * width + column * CELL) * 4
    out.set(rgba.subarray(src, src + CELL * 4), y * CELL * 4)
  }
  return out
}

function rgbKey(cell, i) {
  return `${cell[i]},${cell[i + 1]},${cell[i + 2]}`
}

function mirrorCell(cell) {
  const out = new Uint8Array(cell.length)
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const src = (y * CELL + x) * 4
      const dst = (y * CELL + (CELL - 1 - x)) * 4
      out.set(cell.subarray(src, src + 4), dst)
    }
  }
  return out
}

function sameCell(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function meanX(cell, allow) {
  let sum = 0
  let count = 0
  for (let i = 0; i < cell.length; i += 4) {
    if (!cell[i + 3]) continue
    if (allow && !allow.has(rgbKey(cell, i))) continue
    sum += (i / 4) % CELL
    count += 1
  }
  assert.ok(count > 0)
  return sum / count
}

function opaqueSpan(cell) {
  let top = CELL
  let foot = -1
  for (let i = 0; i < cell.length; i += 4) {
    if (!cell[i + 3]) continue
    const y = Math.floor(i / 4 / CELL)
    top = Math.min(top, y)
    foot = Math.max(foot, y)
  }
  return { height: foot - top + 1, foot }
}

function lowerDiff(a, b) {
  let changed = 0
  const start = (CELL / 2) * CELL * 4
  for (let i = start; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) changed += 1
  }
  return changed
}

function bootLead(cell) {
  const rows = []
  for (let i = 0; i < cell.length; i += 4) {
    if (cell[i + 3] && BOOT.has(rgbKey(cell, i))) rows.push(i / 4)
  }
  assert.ok(rows.length > 0)
  const bottom = Math.max(...rows.map((p) => Math.floor(p / CELL)))
  const lead = rows.filter((p) => Math.floor(p / CELL) >= bottom - 3).map((p) => p % CELL)
  assert.ok(lead.length > 0)
  return lead.reduce((sum, x) => sum + x, 0) / lead.length
}

function norm(v) {
  const length = Math.hypot(...v)
  return v.map((n) => n / length)
}

function heroLeftOnViewerRight(column) {
  const elev = Math.atan(0.9 / Math.SQRT2)
  const yaw = -column * (Math.PI / 4)
  const flat = Math.cos(elev)
  const eye = [Math.sin(yaw) * flat * 6, Math.sin(elev) * 6 + 0.8, Math.cos(yaw) * flat * 6]
  const target = [0, 0.8, 0]
  const forward = norm(target.map((n, i) => n - eye[i]))
  const up = [0, 1, 0]
  const right = norm([
    up[1] * forward[2] - up[2] * forward[1],
    up[2] * forward[0] - up[0] * forward[2],
    up[0] * forward[1] - up[1] * forward[0]
  ])
  const screen = (point) => {
    const rel = point.map((n, i) => n - eye[i])
    return -rel.reduce((sum, n, i) => sum + n * right[i], 0)
  }
  return screen([0.56, 0.7, 0.2]) > screen([0, 0.8, 0])
}

test("no direction equals another or its mirror, and the walk stays on the palette", () => {
  const sheet = readWalkSheet(walkSheetPath(root))
  const normal = readWalkSheet(walkNormalPath(root))
  const columns = []
  const feet = []
  const heights = []
  for (let column = 0; column < DIRS; column++) {
    const frames = []
    for (let row = 0; row < ROWS; row++) {
      const pix = cellAt(sheet.rgba, sheet.width, column, row)
      const norms = cellAt(normal.rgba, normal.width, column, row)
      const span = opaqueSpan(pix)
      heights.push(span.height)
      feet.push(span.foot)
      let skin = 0
      let cape = 0
      for (let i = 0; i < pix.length; i += 4) {
        assert.equal(pix[i + 3], norms[i + 3], `normal alpha column ${column} row ${row}`)
        if (!pix[i + 3]) continue
        const key = rgbKey(pix, i)
        assert.ok(PALETTE.has(key), `pixel outside the palette ${key}`)
        if (SKIN.has(key)) skin += 1
        if (CAPE.has(key)) cape += 1
      }
      if (column === 3 || column === 4 || column === 5) {
        assert.equal(skin, 0, `face on a back view column ${column}`)
        assert.ok(cape > 0, `cape missing on column ${column}`)
      }
      const side = meanX(pix, SHIELD) - meanX(pix)
      if (heroLeftOnViewerRight(column)) assert.ok(side >= 2, `shield column ${column} row ${row}`)
      else assert.ok(side <= -2, `shield column ${column} row ${row}`)
      frames.push(pix)
    }
    const blob = Buffer.concat(frames.map((frame) => Buffer.from(frame)))
    const mirrored = Buffer.concat(frames.map((frame) => Buffer.from(mirrorCell(frame))))
    for (const other of columns) {
      assert.ok(!blob.equals(other.blob), `direction ${column} equals another`)
      assert.ok(!blob.equals(other.mirrored), `direction ${column} is a mirror`)
    }
    columns.push({ blob, mirrored })
    for (let row = 0; row < WALK; row++) {
      const moved = lowerDiff(frames[row], frames[(row + 1) % WALK])
      assert.ok(moved >= 8, `walk legs moved ${moved} px on column ${column}`)
    }
    assert.ok(lowerDiff(frames[0], frames[4]) >= 8, `contacts match on column ${column}`)
  }
  assert.ok(bootLead(cellAt(sheet.rgba, sheet.width, 0, 0)) > CELL / 2)
  assert.ok(bootLead(cellAt(sheet.rgba, sheet.width, 0, 4)) < CELL / 2)
  for (const height of heights) assert.ok(Math.abs(height - (FILL + 2)) <= 1)
  const baseline = feet[0]
  for (const foot of feet) assert.ok(Math.abs(foot - baseline) <= 1)
  assert.equal(sameCell(cellAt(sheet.rgba, sheet.width, 0, 0), cellAt(sheet.rgba, sheet.width, 0, 2)), false)
})
