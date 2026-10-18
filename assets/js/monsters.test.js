import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius } from "../models/registry.js"
import { nightYardLift, nightYardPixels, nightYardRead } from "../models/run.js"
import { renderParts } from "../models/raster.js"
import { cycleLight, groundColor, litGround } from "./scene.js"
import { monsterRim } from "./bodies.js"
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
  assert.equal(nightYardRead.bat, 16)
  assert.equal(nightYardRead.boss, 48)

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
  assert.deepEqual(monsterRim("goblin"), { color: 0x140c0a, scale: 1 })
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
