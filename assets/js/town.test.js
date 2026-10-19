import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, houseParts, houseVariant, keepParts, modelParts, models } from "../models/registry.js"
import { gameFrame, renderParts } from "../models/raster.js"
import { keepReadabilityFloor, readability } from "./art_score.js"
import { groundPixels } from "./ground.js"
import { cameraDistance, dirtRadius, viewScale, zoomFor } from "./town.js"
import { groundUnderMask } from "./yard_sample.js"

test("thirty trees share one mesh", () => {
  const started = performance.now()
  const first = modelParts("tree")
  for (let i = 0; i < 29; i++) assert.equal(modelParts("tree"), first)
  assert.ok(performance.now() - started < 1000, "a tree rebuilt the character sheets")
})

test("the keep reads against the yard at the gameplay camera", () => {
  assert.equal(keepReadabilityFloor.height, 197)
  assert.equal(keepReadabilityFloor.contrast, 25)
  const grounds = {}
  for (const phase of ["day", "dusk", "night"]) grounds[phase] = groundPixels(phase)
  const { frame, camera } = gameFrame(0)
  let shortest = Infinity
  let quietest = Infinity
  for (const light of ["day", "dusk", "night"]) {
    const image = renderParts(keepParts(0), light, 0)
    const rgb = groundUnderMask(image, camera, frame, grounds[light])
    const read = readability(image, { rgb, width: image.width, height: image.height })
    assert.ok(read.height >= keepReadabilityFloor.height, `${light} is ${read.height}px`)
    assert.ok(read.contrast >= keepReadabilityFloor.contrast, `${light} contrast ${read.contrast}`)
    if (read.height < shortest) shortest = read.height
    if (read.contrast < quietest) quietest = read.contrast
  }
  assert.ok(keepReadabilityFloor.height >= shortest * 0.5, `height floor is under half of ${shortest}`)
  assert.ok(keepReadabilityFloor.contrast >= quietest * 0.5, `contrast floor is under half of ${quietest}`)
})

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
    const courses = parts.filter((part) => part.name === "course")
    assert.ok(courses.length >= 8)
    assert.ok(courses.some((part) => part.color === 0x4b3c33))
    assert.ok(courses.some((part) => part.color === 0x654e41))
    assert.ok(courses.some((part) => part.color === 0x2c2a2a))
    assert.equal(parts.find((part) => part.name === "tower").color, 0x4b3c33)
  }
  assert.deepEqual(
    modelParts("keep").map((part) => part.name),
    keepParts(0).map((part) => part.name)
  )
})

test("the yard kit is a palisade, wheat, a stone tower, and a thatched house", () => {
  const wall = modelParts("wall")
  const posts = wall.filter((part) => part.name === "post")
  assert.equal(posts.length, 5)
  assert.ok(posts.every((part) => part.h >= 40 && part.w >= 7))
  assert.equal(wall.filter((part) => part.name === "rail").length, 2)
  assert.ok(wall.some((part) => part.name === "flame"))
  const field = modelParts("field")
  assert.ok(field.filter((part) => part.name === "stalk").length >= 5)
  assert.ok(field.voxelCount >= 12)
  assert.ok(field.some((part) => part.name === "soil" && part.color === 0x4d433b))
  assert.ok(field.some((part) => part.name === "stalk" && part.color === 0x976122))
  assert.equal(modelParts("tower").filter((part) => part.name === "merlon").length, 2)
  const forge = modelParts("forge")
  assert.ok(forge.some((part) => part.name === "roof" && part.color === 0x43382e))
  assert.ok(forge.some((part) => part.color === 0x4b3c33))
})

test("a house is a timber cottage with a lit window", () => {
  const listed = models().find((model) => model.id === "house")
  assert.equal(listed.family, "town")
  assert.equal(listed.collider.r, 18)
  assert.ok(listed.voxels >= 12)
  assert.equal(JSON.stringify(modelParts("house")), JSON.stringify(houseParts(0)))
  assert.equal(houseVariant(0, 0), 0)
  assert.equal(houseVariant(0, 36), 1)
  assert.equal(houseVariant(0, 72), 2)
  assert.equal(houseVariant(-36, 36), 2)
  assert.equal(houseVariant(36, -72), 1)
  const stamps = [0, 1, 2].map((variant) => stamp(houseParts(variant)))
  assert.equal(new Set(stamps).size, 3)
  const windows = [0, 1, 2].map((variant) => houseParts(variant).find((part) => part.name === "window").x)
  assert.equal(new Set(windows).size, 3)
  const top = (variant) => Math.max(...houseParts(variant).map((part) => part.y + part.h / 2))
  assert.ok(top(2) > top(0))
  assert.ok(top(2) > top(1))
  for (const variant of [0, 1, 2]) {
    const parts = houseParts(variant)
    assert.ok(parts.voxelCount >= 12)
    assert.ok(parts.some((part) => part.name === "frame" && part.color === 0x8e755b))
    assert.ok(parts.some((part) => part.name === "panel" && part.color === 0xe6ccad))
    assert.ok(parts.some((part) => part.name === "roof" && part.color === 0x43382e))
    assert.ok(parts.some((part) => part.name === "window" && part.color === 0xeea821))
    assert.ok(horizontalRadius(parts) <= 18 * fitSlack)
    assert.ok(extent(parts, "x") > 22)
    assert.ok(extent(parts, "y") > 14)
    assert.ok(extent(parts, "z") > 18)
  }
})

function stamp(parts) {
  return parts
    .map((part) => [part.name, part.color, part.x, part.y, part.z, part.w, part.h, part.d].join(":"))
    .sort()
    .join("|")
}

function extent(parts, axis) {
  let min = Infinity
  let max = -Infinity
  for (const part of parts) {
    const center = axis === "x" ? part.x : axis === "y" ? part.y : part.z
    const half = axis === "x" ? part.w / 2 : axis === "y" ? part.h / 2 : part.d / 2
    min = Math.min(min, center - half)
    max = Math.max(max, center + half)
  }
  return max - min
}

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
