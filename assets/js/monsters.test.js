import assert from "node:assert/strict"
import test from "node:test"
import { horizontalRadius, modelParts } from "../models/registry.js"
import { nightYardLift, nightYardPixels, nightYardRead } from "../models/run.js"
import { renderParts } from "../models/raster.js"
import { cycleLight, groundColor, litGround } from "./scene.js"
import { monsterRim } from "./bodies.js"

const BONE = 0x908b8a
const STEEL = 0xd8cfc3
const TORCH = 0xf5751e
const HIDE = 0x4d433b
const RIDER = 0x4a464c

test("bat wings and the rider read above the night yard", () => {
  const night = litGround(groundColor, cycleLight.night)
  const floor = night.luma + 18
  assert.ok(litGround(HIDE, cycleLight.night).luma < night.luma)
  assert.ok(litGround(RIDER, cycleLight.night).luma < night.luma)
  assert.ok(litGround(BONE, cycleLight.night).luma >= floor)
  assert.ok(litGround(STEEL, cycleLight.night).luma >= floor)

  const bat = modelParts("bat")
  assert.ok(bat.some((part) => part.name === "wing" && part.color === BONE))
  assert.ok(bat.some((part) => part.name === "wing" && part.d >= 5))
  assert.ok(bat.some((part) => part.name === "body" && part.color === HIDE))
  assert.ok(horizontalRadius(bat) <= 12 * 2)

  const boss = modelParts("boss")
  assert.ok(boss.some((part) => part.name === "eye" && part.color === TORCH))
  assert.ok(boss.some((part) => part.name === "helm" && part.color === STEEL))
  assert.ok(boss.some((part) => part.name === "body" && part.color === STEEL))
  assert.ok(boss.some((part) => part.name === "horse" && part.color === RIDER))
  const reach = horizontalRadius(boss)
  assert.ok(reach > 50, `rider reach ${reach}`)
  assert.ok(reach <= 34 * 2)

  assert.equal(nightYardLift, 18)
  assert.ok(nightYardRead.bat >= 80)
  assert.ok(nightYardRead.boss >= 1000)
  for (const id of ["bat", "boss"]) {
    const above = nightYardPixels(renderParts(modelParts(id), "night"), night.luma)
    assert.ok(above >= nightYardRead[id], `${id} night yard read ${above}`)
    assert.ok(nightYardRead[id] >= above * 0.5, `${id} recorded ${nightYardRead[id]} is under half of ${above}`)
  }

  assert.deepEqual(monsterRim("bat"), { color: BONE, scale: 1.2 })
  assert.deepEqual(monsterRim("boss"), { color: BONE, scale: 1.2 })
  assert.deepEqual(monsterRim("goblin"), { color: 0x140c0a, scale: 1 })
})
