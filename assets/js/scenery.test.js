import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, modelParts } from "../models/registry.js"
import { forestWallSlots, sceneryForest, scenerySlots } from "./scenery.js"

test("the outer ring is stumps and felled logs with no wood", () => {
  const look = sceneryForest()
  assert.deepEqual(look.parts, ["stump", "log"])
  assert.equal(look.wood, 0)
  assert.equal(look.parts.includes("crown"), false)
  assert.equal(look.parts.includes("bough"), false)
  assert.ok(look.count > 0)
})

test("seventy stumps and felled logs stand in three rings behind the layered pines", () => {
  const look = sceneryForest()
  assert.equal(look.count, 70)
  assert.equal(
    look.layers.reduce((sum, layer) => sum + layer.count, 0),
    70
  )
  const dists = look.layers.map((layer) => layer.dist)
  assert.deepEqual(dists, [320, 430, 560])
  assert.deepEqual(
    dists,
    [...dists].sort((a, b) => a - b)
  )
  assert.ok(dists[0] >= 300)
  assert.equal(new Set(look.layers.map((layer) => layer.scale)).size, look.layers.length)
  const slots = scenerySlots()
  assert.equal(slots.length, 70)
  for (const slot of slots) assert.ok(Math.hypot(slot.x, slot.z) >= 300)
  const tree = modelParts("tree")
  const boughs = tree.filter((part) => part.name === "bough")
  assert.ok(boughs.length >= 3)
  assert.ok(boughs.every((part) => part.color === 0x353e27 || part.color === 0x374115))
  assert.ok(tree.some((part) => part.name === "trunk" && part.color === 0x8e755b))
  assert.ok(horizontalRadius(tree) <= 16 * fitSlack)
  const scenery = modelParts("scenery")
  assert.ok(scenery.some((part) => part.name === "stump"))
  assert.ok(scenery.some((part) => part.name === "log"))
  assert.equal(
    scenery.some((part) => part.name === "bough" || part.name === "crown"),
    false
  )
  assert.ok(scenery.every((part) => part.color === 0x8e755b))
  assert.ok(horizontalRadius(scenery) <= look.radiusBottom * fitSlack)
})

test("a pine wall stands inside the bare outer ring and leaves the paths open", () => {
  const slots = forestWallSlots()
  assert.ok(slots.length >= 80, `wall ${slots.length}`)
  const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  for (const slot of slots) {
    const radius = Math.hypot(slot.x, slot.z)
    assert.ok(radius > 190 && radius < 300, `radius ${radius}`)
    for (const cardinal of cardinals) {
      const span = Math.abs(slot.angle - cardinal) % (Math.PI * 2)
      const gap = Math.min(span, Math.PI * 2 - span)
      assert.ok(gap >= 0.22, `path gap ${gap}`)
    }
  }
  assert.equal(scenerySlots().length, 70)
})
