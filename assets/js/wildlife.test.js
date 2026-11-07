import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { floraBands, floraFree } from "./flora.js"
import { monsterSheetPicture } from "./hd2d/picture.js"
import { readRgbaPng } from "./hd2d/png.js"
import { sheetRow } from "./pictures.js"
import { DEER_GRAZE_MS, DEER_SHEET, DEER_WALK_MS, deerAt, deerBand, deerCount, deerCycle, deerSheetUrl, deerSlots } from "./wildlife.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function cellRows(image, cell, column, row) {
  let top = -1
  let bottom = -1
  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const i = ((row * cell + y) * image.width + column * cell + x) * 4
      if (!image.rgba[i + 3]) continue
      if (top < 0) top = y
      bottom = y
      break
    }
  }
  return top < 0 ? null : [top, bottom]
}

test("deer homes are the same for a seed and move with the seed or the attempt", () => {
  assert.deepEqual(deerSlots(7, 0), deerSlots(7, 0))
  assert.notDeepEqual(deerSlots(7, 0), deerSlots(8, 0))
  assert.notDeepEqual(deerSlots(7, 0), deerSlots(7, 1))
  assert.deepEqual(deerSlots(), deerSlots(1, 0))
})

test("every deer stays on the forest-edge ring, off the roads, and walks", () => {
  assert.equal(deerBand, floraBands.edge)
  assert.deepEqual(deerBand, { near: 205, far: 290 })
  assert.equal(deerCount, 4)
  const cycle = deerCycle()
  for (let seed = 0; seed < 40; seed++) {
    const slots = deerSlots(seed, seed % 3)
    assert.equal(slots.length, deerCount)
    let moved = false
    let grazed = false
    for (const slot of slots) {
      assert.notEqual(slot.sweep, 0, `seed ${seed} has no walk`)
      const home = Math.hypot(slot.x, slot.z)
      assert.ok(home >= deerBand.near - 1e-9 && home <= deerBand.far + 1e-9)
      assert.equal(floraFree(slot.x, slot.z), true)
      for (let now = -cycle; now <= cycle; now += 200) {
        const pose = deerAt(slot, now)
        const radius = Math.hypot(pose.x, pose.z)
        assert.ok(Math.abs(radius - slot.radius) < 1e-6, `${seed} left its ring`)
        assert.ok(radius >= deerBand.near - 1e-6 && radius <= deerBand.far + 1e-6)
        assert.equal(floraFree(pose.x, pose.z), true, `${seed} ${now} on a road`)
        const poseAngle = Math.atan2(pose.z, pose.x)
        const tangent = Math.cos(poseAngle) * Math.cos(pose.facing) + Math.sin(poseAngle) * Math.sin(pose.facing)
        assert.ok(Math.abs(tangent) < 1e-6, `facing ${pose.facing} not along the ring`)
        assert.equal(pose.moving, !pose.graze)
        if (pose.moving) moved = true
        else grazed = true
      }
    }
    assert.equal(moved, true)
    assert.equal(grazed, true)
  }
})

test("grazing loops the attack rows and walking loops the walk rows", () => {
  const layout = monsterSheetPicture(DEER_SHEET)
  assert.deepEqual(layout, { directions: 8, frames: 20, walk: 8, attack: 6, death: 6, idle: 0 })
  const graze = new Set()
  for (let t = 0; t < layout.attack * 140; t += 140) graze.add(sheetRow(layout, { graze: true }, t))
  assert.deepEqual([...graze], [8, 9, 10, 11, 12, 13])
  const walk = new Set()
  for (let t = 0; t < layout.walk * 160; t += 160) walk.add(sheetRow(layout, { moving: true, graze: true }, t))
  assert.deepEqual([...walk], [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(sheetRow(layout, {}, 5000), 0)
  assert.equal(sheetRow(layout, { graze: true, dead: true, deadAt: 0 }, 0), layout.walk + layout.attack)
  const slot = { ...deerSlots(3, 0)[0], offset: 0 }
  const samples = []
  for (let now = 0; now < deerCycle(); now += 50) samples.push(deerAt(slot, now))
  const grazeMs = samples.filter((pose) => pose.graze).length * 50
  const walkMs = samples.filter((pose) => pose.moving).length * 50
  assert.equal(grazeMs, 2 * DEER_GRAZE_MS)
  assert.equal(walkMs, 2 * DEER_WALK_MS)
  for (const pose of samples) {
    const row = sheetRow(layout, pose, 0)
    if (pose.moving) assert.ok(row < layout.walk)
    else assert.ok(row >= layout.walk && row < layout.walk + layout.attack)
  }
})

test("the deer sheet on disk is the walker layout the client reads", () => {
  const image = readRgbaPng(fs.readFileSync(path.join(root, "priv/static", deerSheetUrl())))
  const layout = monsterSheetPicture(DEER_SHEET)
  assert.equal(image.width, 8 * DEER_SHEET.cell)
  assert.equal(image.height, layout.frames * DEER_SHEET.cell)
  assert.equal(DEER_SHEET.footRow, DEER_SHEET.cell - 8 + 1)
  const asset = JSON.parse(fs.readFileSync(path.join(root, "assets/reference/deer/asset.json"), "utf8"))
  assert.equal(asset.sheet.cell, DEER_SHEET.cell)
  assert.equal(asset.sheet.height, DEER_SHEET.figure)
  assert.equal(asset.sheet.world_height, DEER_SHEET.world)
  for (let column = 0; column < 8; column++) {
    const [top, bottom] = cellRows(image, DEER_SHEET.cell, column, 0)
    assert.equal(bottom, DEER_SHEET.footRow, `column ${column}`)
    assert.equal(bottom - top + 1, DEER_SHEET.figure, `column ${column}`)
    for (let row = 0; row < layout.walk + layout.attack; row++) {
      assert.equal(cellRows(image, DEER_SHEET.cell, column, row)[1], DEER_SHEET.footRow, `${column},${row}`)
    }
  }
})

test("the view pools the deer with the flora and steps them from the sim tick", () => {
  const src = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  const census = src.indexOf("const forestLook = forestState()")
  assert.ok(src.indexOf("const floraPool = []") < census)
  assert.ok(src.indexOf("const deerPool = []") < census)
  assert.match(src, /placeDeer\(Number\.isInteger\(snap && snap\.seed\)/)
  assert.match(src, /stepDeer\(deerMillis\(\)\)/)
  assert.match(src, /deerTick \+ \(performance\.now\(\) - deerTickAt\) \/ 50/)
  assert.match(src, /new THREE\.Mesh\(\s*deerGeometry/)
  assert.match(src, /sheetRow\(deerLayout, \{ moving: pose\.moving, graze: pose\.graze \}/)
  assert.match(src, /deer-sheet\.png|deerSheetUrl\(\)/)
})
