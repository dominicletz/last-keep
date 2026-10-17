import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, keepParts, modelParts } from "../models/registry.js"
import { cameraDistance, dirtRadius, viewScale, zoomFor } from "./town.js"

test("the keep tower grows a course of stone at each rank", () => {
  const heights = [0, 1, 2, 3, 4].map((rank) => keepParts(rank).find((part) => part.name === "tower").h)
  assert.deepEqual(heights, [104, 118, 132, 146, 160])
  assert.equal(keepParts(1).some((part) => part.name === "battlement"), false)
  assert.equal(keepParts(2).some((part) => part.name === "battlement"), true)
  assert.equal(keepParts(4).some((part) => part.name === "banner"), true)
  for (const rank of [0, 1, 2, 3, 4]) {
    const parts = keepParts(rank)
    assert.ok(horizontalRadius(parts) <= 54 * fitSlack)
    assert.ok(parts.some((part) => part.name === "roof" && part.color === 0x43382e))
    assert.ok(parts.some((part) => part.name === "brazier"))
    assert.ok(parts.filter((part) => part.name === "merlon").length >= 4)
    assert.ok(parts.filter((part) => part.name === "house").length >= 2)
    assert.ok(parts.some((part) => part.name === "belfry" && part.color === 0xeea821))
    assert.ok(parts.some((part) => part.name === "pine" && part.color === 0x353e27))
  }
  assert.deepEqual(
    modelParts("keep").map((part) => part.name),
    keepParts(0).map((part) => part.name)
  )
})

test("the yard kit is a palisade, wheat, a stone tower, and a thatched house", () => {
  const wall = modelParts("wall")
  assert.equal(wall.filter((part) => part.name === "post").length, 5)
  assert.ok(wall.some((part) => part.name === "flame"))
  assert.ok(modelParts("field").filter((part) => part.name === "stalk").length >= 5)
  assert.equal(modelParts("tower").filter((part) => part.name === "merlon").length, 2)
  const forge = modelParts("forge")
  assert.ok(forge.some((part) => part.name === "roof" && part.color === 0x43382e))
  assert.ok(forge.some((part) => part.color === 0x554034))
})

test("each keep rank pulls the camera back and widens the yard", () => {
  assert.equal(cameraDistance(0), 150)
  assert.equal(dirtRadius(0), 150)
  assert.equal(viewScale(0), 1)
  assert.ok(cameraDistance(1) > cameraDistance(0))
  assert.ok(dirtRadius(2) > dirtRadius(1))
  assert.ok(viewScale(3) > viewScale(2))
  assert.equal(cameraDistance(4), cameraDistance(9))
  const zoom = zoomFor({ town: 2, camera: 222, dirt: 230, view_scale: 1.24 })
  assert.equal(zoom.camera, 222)
  assert.equal(zoom.dirt, 230)
  assert.equal(zoom.scale, 1.24)
})
