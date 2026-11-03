import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import * as THREE from "three"
import { releaseGeometries } from "../meshes.js"
import { monsterHeights } from "../monsters.js"
import { flierLift, MONSTER_SHEETS, monsterSheetUrl, sheetRow, spriteHeight } from "../pictures.js"
import { createPicture, monsterSheetPicture, SHEET_TEXEL, sheetCardGeometry } from "./picture.js"
import { readRgbaPng } from "./png.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const GOBLIN = MONSTER_SHEETS.goblin
const SHEET_KINDS = ["goblin", "skeleton"]

function sheetImage(kind) {
  return readRgbaPng(fs.readFileSync(path.join(root, "priv/static", monsterSheetUrl(kind))))
}

// Opaque rows of one cell: [top, bottom], or null for an empty cell.
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

function stoneAndGrounds() {
  const map = new THREE.DataTexture(new Uint8Array([90, 80, 70, 255]), 1, 1)
  const stoneMat = new THREE.MeshBasicMaterial({ map, color: 0xffffff })
  const keep = new THREE.Group()
  keep.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), stoneMat))
  const floors = [0, 1, 2, 3].map(
    () => new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: new THREE.DataTexture(new Uint8Array(4), 1, 1) }))
  )
  return { stoneMat, keep, floors }
}

// The voxel card render.js builds: a sprite, a rim sprite, picture and kind.
function monsterGroup(kind) {
  const voxel = { directions: 8, frames: 11, walk: 4, attack: 3, death: 4, w: 12, h: monsterHeights[kind], d: 6, y: 0 }
  const map = new THREE.DataTexture(new Uint8Array([90, 100, 50, 255]), 1, 1)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.4 }))
  const rimMap = new THREE.DataTexture(new Uint8Array([144, 139, 138, 255]), 1, 1)
  const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: rimMap }))
  const group = new THREE.Group()
  group.add(rim, sprite)
  Object.assign(group.userData, { role: "monster", kind, card: sprite, rim, picture: voxel, parts: 88 })
  return { group, sprite, rim, map, rimMap }
}

function sheetTexture() {
  const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1)
  texture.flipY = true
  return texture
}

for (const kind of SHEET_KINDS) {
  test(`the ${kind} sheet on disk is the layout the client reads`, () => {
    const SPEC = MONSTER_SHEETS[kind]
    const image = sheetImage(kind)
    const layout = monsterSheetPicture(SPEC)
    assert.deepEqual(layout, { directions: 8, frames: 20, walk: 8, attack: 6, death: 6, idle: 0 })
    assert.equal(image.width, 8 * SPEC.cell)
    assert.equal(image.height, layout.frames * SPEC.cell)
    // The builder's own config says the same.
    const asset = JSON.parse(fs.readFileSync(path.join(root, `assets/reference/${kind}/asset.json`), "utf8"))
    assert.equal(asset.sheet.cell, SPEC.cell)
    assert.equal(asset.sheet.height, SPEC.figure)
    assert.equal(asset.sheet.world_height, monsterHeights[kind])
    assert.deepEqual(Object.keys(asset.clips), Object.keys(SPEC.rows))
    for (let column = 0; column < 8; column++) {
      // The start pose stands figure px tall on the foot row in every direction.
      const [top, bottom] = cellRows(image, SPEC.cell, column, 0)
      assert.equal(bottom, SPEC.footRow, `column ${column}`)
      assert.ok(Math.abs(bottom - top + 1 - SPEC.figure) <= 1, `column ${column} is ${bottom - top + 1} px`)
      for (let row = 0; row < layout.frames; row++) {
        const rows = cellRows(image, SPEC.cell, column, row)
        assert.ok(rows, `cell ${column},${row} is empty`)
        // Walk feet stay on the line; attack and death never sink past it by more than the checker allows.
        if (row < layout.walk) assert.equal(rows[1], SPEC.footRow, `walk ${column},${row}`)
        else assert.ok(Math.abs(rows[1] - SPEC.footRow) <= 3, `cell ${column},${row} feet at ${rows[1]}`)
      }
    }
  })
}

test("png reads the filtered rows an image editor writes", () => {
  // Pillow writes adaptive filters; these sums come from Pillow's own decode.
  const image = sheetImage("goblin")
  let opaque = 0
  let ink = 0
  for (let i = 0; i < image.rgba.length; i += 4) {
    if (!image.rgba[i + 3]) continue
    opaque += 1
    ink += image.rgba[i] + image.rgba[i + 1] + image.rgba[i + 2]
  }
  assert.equal(opaque, 160329)
  assert.equal(ink, 22777390)
})

test("the skeleton sheet decodes to Pillow's sums", () => {
  const image = sheetImage("skeleton")
  let opaque = 0
  let ink = 0
  for (let i = 0; i < image.rgba.length; i += 4) {
    if (!image.rgba[i + 3]) continue
    opaque += 1
    ink += image.rgba[i] + image.rgba[i + 1] + image.rgba[i + 2]
  }
  assert.equal(opaque, 158153)
  assert.equal(ink, 33470360)
})

for (const kind of SHEET_KINDS) {
  test(`a ${kind} card keeps the hero texel and stays under the hero and the keep door`, () => {
    const SPEC = MONSTER_SHEETS[kind]
    const drawn = SPEC.figure * SHEET_TEXEL
    // Within one texel of the world height the voxel card and the sim use.
    assert.ok(Math.abs(drawn - monsterHeights[kind]) <= SHEET_TEXEL, `${drawn} vs ${monsterHeights[kind]}`)
    assert.ok(drawn < spriteHeight)
    assert.ok(drawn <= 20 * 1.75)
    const geometry = sheetCardGeometry(SPEC.cell, SPEC.footRow)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    const size = SPEC.cell * SHEET_TEXEL
    assert.ok(Math.abs(box.max.y - box.min.y - size) < 1e-4)
    assert.ok(Math.abs(box.max.x - box.min.x - size) < 1e-4)
    // The lowest outline row ends exactly at y = 0, like the heroes' boots.
    const soles = box.max.y - (SPEC.footRow + 1) * SHEET_TEXEL
    assert.ok(Math.abs(soles) < 1e-4, `soles at ${soles}`)
  })
}

test("a goblin keeps its voxel card until its sheet loads", () => {
  const picture = createPicture()
  const goblin = monsterGroup("goblin")
  assert.equal(picture.dressMonster(goblin.group), false)
  assert.equal(goblin.group.userData.card, goblin.sprite)
  assert.equal(goblin.group.userData.rim, goblin.rim)
  assert.equal(goblin.group.userData.picture.frames, 11)
  assert.equal(goblin.group.userData.hd, undefined)
  assert.throws(() => picture.attachMonsterSheet(sheetTexture(), "wolf"), /monster sheet/)
  assert.throws(() => picture.attachMonsterSheet(null, "goblin"), /monster sheet/)
})

test("dressMonster draws each goblin from its own clone of the sheet", () => {
  const picture = createPicture()
  const sheet = sheetTexture()
  picture.attachMonsterSheet(sheet, "goblin")
  const a = monsterGroup("goblin")
  const b = monsterGroup("goblin")
  let dropped = 0
  for (const texture of [a.map, a.rimMap]) texture.addEventListener("dispose", () => (dropped += 1))
  assert.equal(picture.dressMonster(a.group), true)
  assert.equal(picture.dressMonster(b.group), true)
  assert.equal(picture.dressMonster(a.group), false)
  const card = a.group.userData.card
  assert.equal(card.isMesh, true)
  assert.equal(card.material.isMeshBasicMaterial, true)
  assert.equal(card.castShadow, false)
  assert.equal(card.parent, a.group)
  assert.equal(a.sprite.parent, null)
  assert.equal(a.rim.parent, null)
  assert.equal(a.group.userData.rim, null)
  assert.equal(dropped, 2)
  assert.equal(a.group.userData.hd, "goblin")
  assert.notEqual(card.material.map, sheet)
  assert.notEqual(card.material.map, b.group.userData.card.material.map)
  assert.equal(card.material.map.source, sheet.source)
  assert.equal(card.material.map.repeat.x, 1 / 8)
  assert.equal(card.material.map.repeat.y, 1 / 20)
  assert.equal(sheet.repeat.y, 1)
  assert.deepEqual(a.group.userData.picture, {
    directions: 8,
    frames: 20,
    walk: 8,
    attack: 6,
    death: 6,
    idle: 0,
    w: 12,
    h: GOBLIN.figure * SHEET_TEXEL,
    d: 6,
    y: 0
  })
  assert.equal(a.group.userData.parts, 160)
  // Removing one goblin drops its clone, never the shared sheet.
  let sheetGone = false
  sheet.addEventListener("dispose", () => (sheetGone = true))
  let cloneGone = false
  card.material.map.addEventListener("dispose", () => (cloneGone = true))
  releaseGeometries(a.group)
  assert.equal(cloneGone, true)
  assert.equal(sheetGone, false)
})

test("dress gives a sheet to goblins and skeletons that spawned before it loaded, and leaves other kinds", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const goblin = monsterGroup("goblin")
  const wolf = monsterGroup("wolf")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [], monsters: [goblin.group, wolf.group] })
  assert.equal(goblin.group.userData.card.isSprite, true)
  picture.attachMonsterSheet(sheetTexture(), "goblin")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [], monsters: [goblin.group, wolf.group] })
  assert.equal(goblin.group.userData.card.isMesh, true)
  assert.equal(wolf.group.userData.card, wolf.sprite)
  assert.equal(wolf.group.userData.rim, wolf.rim)
  assert.equal(wolf.group.userData.hd, undefined)
  // The skeleton waits for its own sheet, then draws from it.
  const skeleton = monsterGroup("skeleton")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [], monsters: [skeleton.group] })
  assert.equal(skeleton.group.userData.card.isSprite, true)
  picture.attachMonsterSheet(sheetTexture(), "skeleton")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [], monsters: [skeleton.group] })
  assert.equal(skeleton.group.userData.card.isMesh, true)
  assert.equal(skeleton.group.userData.hd, "skeleton")
  assert.equal(skeleton.group.userData.picture.h, MONSTER_SHEETS.skeleton.figure * SHEET_TEXEL)
  assert.equal(skeleton.group.userData.parts, 160)
  // A hero in the monster list is not a monster.
  const hero = monsterGroup("goblin")
  hero.group.userData.role = "hero"
  assert.equal(picture.dressMonster(hero.group), false)
})

test("goblin cards snap to whole screen pixels like the heroes'", () => {
  const picture = createPicture()
  picture.attachMonsterSheet(sheetTexture(), "goblin")
  const goblin = monsterGroup("goblin")
  picture.dressMonster(goblin.group)
  const card = goblin.group.userData.card
  const camera = new THREE.PerspectiveCamera(15, 1.6, 1, 4000)
  camera.position.set(0, 0, 900)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const scene = new THREE.Scene()
  scene.add(goblin.group)
  goblin.group.updateMatrixWorld()
  const renderer = {
    getDrawingBufferSize: (v) => v.set(1280, 800),
    get info() {
      throw new Error("past the snap")
    }
  }
  assert.throws(() => picture.present(renderer, scene, camera), /past the snap/)
  const worldPerPixel = (2 * 900 * Math.tan(THREE.MathUtils.degToRad(7.5))) / 800
  const pixels = (SHEET_TEXEL * card.scale.x) / worldPerPixel
  assert.ok(pixels >= 1)
  assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${pixels} px per texel`)
})

test("a goblin walks while moving, strikes on an attack, and falls on a kill", () => {
  const layout = monsterSheetPicture(GOBLIN)
  const walkRows = new Set()
  for (let t = 0; t < 8 * 160; t += 160) walkRows.add(sheetRow(layout, { moving: true }, t))
  assert.deepEqual([...walkRows].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(sheetRow(layout, { moving: false }, 5000), 0)
  const strike = [0, 140, 280, 420, 560, 700].map((dt) => sheetRow(layout, { attackAt: 1000, moving: true }, 1000 + dt))
  assert.deepEqual(strike, [8, 9, 10, 11, 12, 13])
  // The strike ends and the walk takes over.
  assert.ok(sheetRow(layout, { attackAt: 1000, moving: true }, 1000 + 6 * 140) < 8)
  const fall = [0, 160, 320, 480, 640, 800, 5000].map((dt) => sheetRow(layout, { dead: true, deadAt: 0 }, dt))
  assert.deepEqual(fall, [14, 15, 16, 17, 18, 19, 19])
})

test("a sheet missing a clip kind falls back to the kinds it has", () => {
  const noAttack = monsterSheetPicture({ ...GOBLIN, rows: { walk: 8, death: 6 } })
  assert.equal(noAttack.frames, 14)
  // A strike keeps walking instead of reading a row that is not there.
  assert.equal(sheetRow(noAttack, { attackAt: 1000, moving: true }, 1000), Math.floor(1000 / 160) % 8)
  assert.deepEqual([0, 160, 5000].map((t) => sheetRow(noAttack, { dead: true, deadAt: 0 }, t)), [8, 9, 13])
  const walkOnly = monsterSheetPicture({ ...GOBLIN, rows: { walk: 8 } })
  assert.deepEqual(walkOnly, { directions: 8, frames: 8, walk: 8, attack: 0, death: 0, idle: 0 })
  assert.throws(() => monsterSheetPicture({ ...GOBLIN, rows: { attack: 6 } }), /walk rows/)
})

test("a flier hovers at its lift and drops to the ground through its death row", () => {
  const lift = 22
  assert.equal(flierLift(0, { dead: true, deadAt: 0 }, 500, 6), 0)
  assert.equal(flierLift(lift, undefined, 500, 6), lift)
  assert.equal(flierLift(lift, { moving: true }, 500, 6), lift)
  // Death: frame 0 still hovers, then it falls ever faster and lands as the
  // last of 6 death frames starts (5 x 160 ms), and stays down.
  const at = (ms) => flierLift(lift, { dead: true, deadAt: 1000 }, 1000 + ms, 6)
  assert.equal(at(0), lift)
  assert.equal(at(160), lift)
  assert.ok(at(480) < lift && at(480) > lift / 2)
  assert.ok(lift - at(320) < at(480) - at(640))
  assert.equal(at(800), 0)
  assert.equal(at(5000), 0)
  for (let ms = 0; ms < 900; ms += 20) assert.ok(at(ms + 20) <= at(ms), `falls at ${ms}`)
  // No death row: the monster is let go at once, so it is not left hanging.
  assert.equal(flierLift(lift, { dead: true, deadAt: 1000 }, 1000, 0), 0)
})

test("render.js lifts only the bat and keeps its shadow disc on the ground", () => {
  const render = fs.readFileSync(path.join(root, "assets/js/render.js"), "utf8")
  assert.match(render, /if \(row\.kind === "bat"\) \{\s+mesh\.userData\.lift = 22/)
  assert.match(render, /const shadow = contactDisc\(10\)\s+mesh\.add\(shadow\)\s+mesh\.userData\.shadow = shadow/)
  assert.match(render, /const lift = flierLift\(mesh\.userData\.lift \|\| 0, mesh\.userData\.pose, performance\.now\(\), picture && picture\.death\)/)
  assert.match(render, /mesh\.position\.set\(snapWorld\(pose\.x \+ spread\.x, step\), lift, /)
  assert.match(render, /if \(mesh\.userData\.shadow\) mesh\.userData\.shadow\.position\.y = 0\.46 - lift/)
  assert.equal((render.match(/userData\.lift = 22/g) || []).length, 1)
})
