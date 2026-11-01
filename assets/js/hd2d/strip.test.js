import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { cellOffset, SHEET_HEROES, sheetRow, walkSheetUrl } from "../pictures.js"
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

// The sheet comes from Grok Imagine clips through script/sprite_from_video.py
// (docs/concepts/SPRITE-PIPELINE.md). script/check_sprite_sheet.py is the full
// local gate; this test reads the committed PNG so a bad sheet cannot land
// even when nobody runs that script.
const CELL = 128
const DIRS = 8
const WALK = 8
const ROWS = 12
const HERO = 88
const FOOT = 117
const OUTLINE = "24,24,24"
const COLUMN = { S: 0, SW: 1, W: 2, NW: 3, N: 4, NE: 5, E: 6, SE: 7 }

// Warrior test names predate the other sheets and stay as they were.
function sheetTest(hero, name) {
  return hero === "warrior" ? name : `${name} (${hero})`
}

test("every sheet hero loads its own walk sheet and normal map", () => {
  assert.deepEqual(SHEET_HEROES, ["warrior", "mage", "scout"])
  for (const hero of SHEET_HEROES) {
    assert.equal(walkSheetUrl(hero), `images/hd2d/${hero}-walk.png`)
    assert.equal(walkSheetUrl(hero, true), `images/hd2d/${hero}-walk-normal.png`)
    assert.equal(walkSheetPath(root, hero), path.join(root, "priv/static", walkSheetUrl(hero)))
    assert.equal(walkNormalPath(root, hero), path.join(root, "priv/static", walkSheetUrl(hero, true)))
  }
  assert.equal(walkSheetPath(root), walkSheetPath(root, "warrior"))
  const warrior = readWalkSheet(walkSheetPath(root, "warrior"))
  const mage = readWalkSheet(walkSheetPath(root, "mage"))
  const scout = readWalkSheet(walkSheetPath(root, "scout"))
  assert.notEqual(changedPixels(warrior.rgba, mage.rgba), 0)
  assert.notEqual(changedPixels(mage.rgba, scout.rgba), 0)
  assert.notEqual(changedPixels(warrior.rgba, scout.rgba), 0)
})

for (const hero of SHEET_HEROES) {
  test(sheetTest(hero, "the committed walk sheet is 128 px cells and the normal matches its alpha"), () => {
    const committed = readWalkSheet(walkSheetPath(root, hero))
    const committedNormal = readWalkSheet(walkNormalPath(root, hero))
    assert.equal(committed.width, CELL * DIRS)
    assert.equal(committed.height, CELL * ROWS)
    assert.equal(committedNormal.width, committed.width)
    assert.equal(committedNormal.height, committed.height)
    for (let i = 3; i < committed.rgba.length; i += 4) {
      assert.ok(committed.rgba[i] === 0 || committed.rgba[i] === 255)
      assert.equal(committed.rgba[i], committedNormal.rgba[i])
    }
    assert.ok(fs.existsSync(path.join(root, "script/sprite_from_video.py")))
    for (const dir of Object.keys(COLUMN)) {
      for (const clip of [`walk-${dir}.mp4`, `idle-${dir}.mp4`, `dirs/${dir}.png`]) {
        assert.ok(fs.existsSync(path.join(root, `assets/reference/${hero}/video`, clip)), clip)
      }
    }
  })
}

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
      out.set(cell.subarray(src, src + 4), (y * CELL + (CELL - 1 - x)) * 4)
    }
  }
  return out
}

function changedPixels(a, b, fromRow = 0) {
  let changed = 0
  for (let i = fromRow * CELL * 4; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) changed += 1
  }
  return changed
}

function hue(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return { h: 0, chroma: 0, light: max / 255 }
  const d = max - min
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, chroma: d / 255, light: (max + min) / 510 }
}

function isBlue(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma >= 0.12 && c.h >= 195 && c.h <= 245
}

function isCape(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma >= 0.12 && (c.h >= 340 || c.h <= 12) && c.light < 0.45
}

function isRobe(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma >= 0.12 && c.h >= 205 && c.h <= 235 && !isCrystal(cell, i)
}

function isCrystal(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma > 0.5 && c.h >= 180 && c.h <= 200
}

function isGreen(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma >= 0.12 && c.h >= 70 && c.h <= 140
}

function isSpyglass(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma >= 0.12 && c.h >= 195 && c.h <= 240
}

function isSkin(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma > 0.3 && c.h >= 20 && c.h <= 34 && c.light > 0.5
}

function count(cell, keep) {
  let n = 0
  for (let i = 0; i < cell.length; i += 4) if (cell[i + 3] && keep(cell, i)) n += 1
  return n
}

function isWarm(cell, i) {
  const c = hue(cell[i], cell[i + 1], cell[i + 2])
  return c.chroma > 0.2 && c.h >= 14 && c.h <= 50 && c.light > 0.25
}

function span(cell) {
  let top = CELL
  let foot = -1
  for (let i = 3; i < cell.length; i += 4) {
    if (!cell[i]) continue
    const y = Math.floor(i / 4 / CELL)
    top = Math.min(top, y)
    foot = Math.max(foot, y)
  }
  return { top, foot, height: foot - top + 1 }
}

function meanX(cell, keep) {
  let sum = 0
  let count = 0
  for (let i = 0; i < cell.length; i += 4) {
    if (!cell[i + 3] || (keep && !keep(cell, i))) continue
    sum += (i / 4) % CELL
    count += 1
  }
  return count ? sum / count : null
}

function headCount(cell, keep, columns = [0, CELL]) {
  const { top, foot } = span(cell)
  let count = 0
  const end = top + Math.floor((foot - top) * 0.3)
  for (let y = top; y < end; y++) {
    for (let x = columns[0]; x < columns[1]; x++) {
      const i = (y * CELL + x) * 4
      if (cell[i + 3] && keep(cell, i)) count += 1
    }
  }
  return count
}

// What each sheet hero must show, measured on its start poses in
// assets/reference/<hero>/video/dirs and in script/check_sprite_sheet.py.
const HEAD = [54, 74]
const HERO_MARKS = {
  // W shows the shield face-on and E, NE, SE hide it, so those have no side to hold.
  warrior: {
    propName: "shield",
    prop: isBlue,
    side: { S: 1, SW: 1, NW: -1, N: -1 },
    views(back, front, row) {
      assert.ok(headCount(back, isWarm) <= 6, `face on the back view row ${row}`)
      assert.ok(count(back, isCape) > 200, `cape missing on the back view row ${row}`)
      assert.ok(headCount(front, isWarm) >= 8, `face missing on the front view row ${row}`)
    }
  },
  // The staff is in the right hand, so the crystal is screen-left facing the
  // camera and screen-right from behind. The staff head sits beside the head,
  // so the face is counted only in the head columns.
  mage: {
    propName: "staff crystal",
    prop: isCrystal,
    side: { S: -1, SW: -1, W: -1, NW: -1, N: 1, NE: 1, E: 1, SE: 1 },
    views(back, front, row) {
      assert.ok(headCount(back, isWarm, HEAD) <= 10, `face on the back view row ${row}`)
      assert.ok(count(back, isRobe) > 1000, `hood and robe missing on the back view row ${row}`)
      assert.ok(headCount(front, isWarm, HEAD) >= 30, `face missing on the front view row ${row}`)
      assert.ok(count(front, isCrystal) >= 40, `crystal missing on the front view row ${row}`)
      assert.ok(count(front, isRobe) >= 600, `robe missing on the front view row ${row}`)
    }
  },
  // The spyglass hangs at the left hip: screen-right facing the camera,
  // screen-left from behind. In W and E it sits on the body midline, and SW,
  // N and NE barely show it, so those have no side to hold.
  scout: {
    propName: "spyglass",
    prop: isSpyglass,
    side: { S: 1, NW: -1, SE: 1 },
    views(back, front, row) {
      assert.ok(headCount(back, isSkin, HEAD) <= 6, `face on the back view row ${row}`)
      assert.ok(count(back, isGreen) >= 630, `hood and cloak missing on the back view row ${row}`)
      assert.ok(count(front, isGreen) >= 260, `green missing on the front view row ${row}`)
      assert.ok(count(front, isSpyglass) >= 12, `spyglass missing on the front view row ${row}`)
      assert.ok(headCount(front, isSkin, HEAD) >= 24, `face missing on the front view row ${row}`)
    }
  }
}

for (const hero of SHEET_HEROES) {
  test(sheetTest(hero, "no direction equals another or its mirror, and the walk stays on a small outlined palette"), () => {
    const sheet = readWalkSheet(walkSheetPath(root, hero))
    const colours = new Set()
    const blobs = []
    for (let column = 0; column < DIRS; column++) {
      const frames = []
      for (let row = 0; row < ROWS; row++) {
        const pix = cellAt(sheet.rgba, sheet.width, column, row)
        const { foot, height } = span(pix)
        assert.ok(Math.abs(height - HERO) <= 2, `height ${height} column ${column} row ${row}`)
        assert.ok(Math.abs(foot - FOOT) <= 1, `foot ${foot} column ${column} row ${row}`)
        for (let y = 0; y < CELL; y++) {
          for (let x = 0; x < CELL; x++) {
            const i = (y * CELL + x) * 4
            if (!pix[i + 3]) continue
            colours.add(rgbKey(pix, i))
            const open = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
              const nx = x + dx
              const ny = y + dy
              return nx < 0 || ny < 0 || nx >= CELL || ny >= CELL || !pix[(ny * CELL + nx) * 4 + 3]
            })
            if (open) assert.equal(rgbKey(pix, i), OUTLINE, `edge without outline column ${column} row ${row}`)
          }
        }
        frames.push(pix)
      }
      for (let row = 0; row < WALK; row++) {
        const moved = changedPixels(frames[row], frames[(row + 1) % WALK], CELL / 2)
        assert.ok(moved >= 16, `walk legs moved ${moved} px on column ${column}`)
      }
      assert.ok(changedPixels(frames[0], frames[4], CELL / 2) >= 16, `contacts match on column ${column}`)
      for (let row = WALK; row < ROWS; row++) {
        assert.ok(changedPixels(frames[row], frames[row === ROWS - 1 ? WALK : row + 1]) > 0, `idle frozen on column ${column}`)
      }
      blobs.push(frames)
    }
    colours.delete(OUTLINE)
    assert.ok(colours.size <= 32, `${colours.size} colours`)
    for (let a = 0; a < DIRS; a++) {
      for (let b = 0; b < DIRS; b++) {
        if (a === b) continue
        const same = changedPixels(blobs[a][0], blobs[b][0])
        const mirrored = changedPixels(blobs[a][0], mirrorCell(blobs[b][0]))
        assert.ok(Math.min(same, mirrored) >= 300, `direction ${a} is too close to ${b} or its mirror`)
      }
    }
    const marks = HERO_MARKS[hero]
    for (const [dir, sign] of Object.entries(marks.side)) {
      for (let row = 0; row < ROWS; row++) {
        const pix = blobs[COLUMN[dir]][row]
        const prop = meanX(pix, marks.prop)
        assert.ok(prop !== null, `no ${marks.propName} on ${dir} row ${row}`)
        assert.ok((prop - meanX(pix)) * sign >= 2, `${marks.propName} side ${dir} row ${row}`)
      }
    }
    for (let row = 0; row < ROWS; row++) {
      marks.views(blobs[COLUMN.N][row], blobs[COLUMN.S][row], row)
    }
  })
}
