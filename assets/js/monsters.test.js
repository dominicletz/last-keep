import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { fitSlack, horizontalRadius } from "../models/registry.js"
import { nightYardLift, nightYardPixels, nightYardRead } from "../models/run.js"
import { gameFrame, renderParts } from "../models/raster.js"
import { GROUND_SPAN, GROUND_TEX, groundPixels } from "./ground.js"
import { cycleLight, groundColor, litGround } from "./scene.js"
import { readability, readabilityFloor } from "./art_score.js"
import { monsterRim, rimSeat } from "./bodies.js"
import { monsterHeights, monsterKinds, monsterParts } from "./monsters.js"
import { sheetRow } from "./pictures.js"

const BONE = 0x908b8a
const STEEL = 0xd8cfc3
const HIDE = 0x4d433b
const RIDER = 0x4a464c

test("monster cards keep their scale and their night read", () => {
  const night = litGround(groundColor, cycleLight.night)
  const floor = night.luma + 18
  assert.ok(litGround(HIDE, cycleLight.night).luma < night.luma)
  assert.ok(litGround(RIDER, cycleLight.night).luma < night.luma)
  assert.ok(litGround(BONE, cycleLight.night).luma >= floor)
  assert.ok(litGround(STEEL, cycleLight.night).luma >= floor)
  assert.equal(nightYardLift, 18)
  assert.equal(nightYardRead.bat, 241)
  assert.equal(nightYardRead.boss, 485)

  for (const kind of monsterKinds()) {
    const parts = monsterParts(kind)
    const card = parts[0]
    assert.equal(card.shape, "billboard", kind)
    assert.equal(card.directions, 8, kind)
    assert.equal(card.frames, 11, kind)
    assert.equal(card.walk, 4, kind)
    assert.equal(card.attack, 3, kind)
    assert.equal(card.death, 4, kind)
    assert.equal(card.h, monsterHeights[kind], kind)
    assert.ok(card.h <= 20 * 1.75, kind)
    assert.ok(horizontalRadius(parts) <= monsterRadius(kind), kind)
    if (kind === "troll" || kind === "boss") assert.ok(card.h > 32, kind)
    else assert.ok(card.h < 32, kind)
  }

  for (const id of ["bat", "boss"]) {
    const above = nightYardPixels(renderParts(monsterParts(id), "night"), night.luma)
    assert.ok(above >= nightYardRead[id], `${id} night yard read ${above}`)
    assert.ok(nightYardRead[id] >= above * 0.5, `${id} recorded ${nightYardRead[id]} is under half of ${above}`)
  }

  assert.deepEqual(monsterRim("bat"), { color: BONE, scale: 1.2 })
  assert.deepEqual(monsterRim("boss"), { color: BONE, scale: 1.2 })
  assert.deepEqual(monsterRim("goblin"), { color: BONE, scale: 1.15 })
  assert.deepEqual(monsterRim("wolf"), { color: BONE, scale: 1.15 })
  assert.deepEqual(monsterRim("skeleton"), { color: BONE, scale: 1.15 })

  const boss = monsterParts("boss")
  assert.equal(boss[0].atlasLocked, true)
  assert.equal(monsterParts("boss"), boss)
  const level = rimSeat(18, 1.15, { x: 0, y: 0, z: -10 })
  const drop = (18 * (1.15 - 1)) / 2
  assert.equal(level.y, -drop)
  assert.ok(level.z < 0)
  assert.equal(level.renderOrder, 0)
  const above = rimSeat(18, 1.15, { x: 0, y: -32, z: -150 })
  assert.ok(above.y < -drop)
  assert.equal(above.renderOrder, 0)
})

test("each monster reads against the path and the grass at the gameplay camera", () => {
  const grounds = {}
  for (const phase of ["day", "dusk", "night"]) grounds[phase] = groundPixels(phase)
  const { frame, camera } = gameFrame(0)
  let shortest = Infinity
  let quietest = Infinity
  for (const kind of monsterKinds()) {
    const base = monsterParts(kind)
    for (const [x, z] of [
      [160, 0],
      [160, 80]
    ]) {
      const parts = base.map((part) => ({ ...part, x, z }))
      for (const light of ["day", "dusk", "night"]) {
        const image = renderParts(parts, light, 0)
        const ground = new Uint8Array(image.width * image.height * 3)
        for (let i = 0; i < image.mask.length; i++) {
          if (!image.mask[i]) continue
          const px = i % image.width
          const py = (i / image.width) | 0
          const ndcX = ((px + 0.5) / frame.bufferWidth) * 2 - 1
          const ndcY = -(((py + 0.5) / frame.bufferHeight) * 2 - 1)
          const origin = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera)
          const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera)
          const dir = far.sub(origin)
          const t = -origin.y / dir.y
          const worldX = origin.x + dir.x * t
          const worldZ = origin.z + dir.z * t
          const tex = grounds[light]
          const u = Math.floor((worldX / GROUND_SPAN + 0.5) * GROUND_TEX)
          const v = Math.floor((-worldZ / GROUND_SPAN + 0.5) * GROUND_TEX)
          const o = (v * GROUND_TEX + u) * 4
          ground[i * 3] = tex[o]
          ground[i * 3 + 1] = tex[o + 1]
          ground[i * 3 + 2] = tex[o + 2]
        }
        const read = readability(image, { rgb: ground, width: image.width, height: image.height })
        assert.ok(read.height >= readabilityFloor.height, `${kind} ${light} is ${read.height}px`)
        assert.ok(read.contrast >= readabilityFloor.contrast, `${kind} ${light} contrast ${read.contrast}`)
        if (read.height < shortest) shortest = read.height
        if (read.contrast < quietest) quietest = read.contrast
      }
    }
  }
  assert.ok(readabilityFloor.height >= shortest * 0.5, `height floor is under half of ${shortest}`)
  assert.ok(readabilityFloor.contrast >= quietest * 0.5, `contrast floor is under half of ${quietest}`)
})

test("a monster sheet walks, strikes, and falls", () => {
  const picture = monsterParts("goblin")[0]
  assert.equal(sheetRow(picture, {}, 0), 0)
  assert.equal(sheetRow(picture, { moving: true }, 160), 1)
  assert.equal(sheetRow(picture, { attackAt: 1000 }, 1000), 4)
  assert.equal(sheetRow(picture, { dead: true, deadAt: 0 }, 480), 10)
})

function monsterRadius(kind) {
  const limits = { goblin: 16, skeleton: 13, wolf: 13, troll: 22, bat: 12, boss: 34 }
  return limits[kind] * fitSlack
}
