import assert from "node:assert/strict"
import test from "node:test"
import { carve, detailFloor, detailProblems, meshVoxels } from "./voxels.js"

test("a straight run of voxels meshes into one box", () => {
  const parts = meshVoxels(
    [
      { x: 0, y: 0, z: 0, color: 1, name: "bar", mark: false },
      { x: 1, y: 0, z: 0, color: 1, name: "bar", mark: false },
      { x: 2, y: 0, z: 0, color: 1, name: "bar", mark: false }
    ],
    2
  )
  assert.equal(parts.length, 1)
  assert.equal(parts[0].w, 6)
  assert.equal(parts.voxelCount, 3)
})

test("a taller cell step raises the mesh without widening it", () => {
  const paint = ({ fill }) => fill(0, 0, 0, 1, 3, 0, "post", 1)
  const cube = carve(2, paint)
  const tall = carve({ x: 2, y: 4, z: 2 }, paint)
  const wide = (parts) => Math.max(...parts.map((part) => part.w))
  const high = (parts) => Math.max(...parts.map((part) => part.y + part.h / 2))
  assert.equal(wide(tall), wide(cube))
  assert.ok(high(tall) > high(cube))
})

test("three boxes fail the detail floor and a voxel figure clears it", () => {
  const boxes = detailProblems([
    {
      id: "lump",
      family: "monster",
      parts: [
        { name: "a", shape: "box" },
        { name: "b", shape: "box" },
        { name: "c", shape: "box" }
      ]
    }
  ])
  assert.ok(boxes.some((line) => line.includes("lump detail 3")))
  assert.ok(boxes.some((line) => line.includes(String(detailFloor))))
  const figure = carve(1, ({ fill }) => {
    fill(0, 0, 0, 3, 5, 1, "body", 1)
  })
  assert.ok(figure.voxelCount >= detailFloor)
  assert.deepEqual(detailProblems([{ id: "goblin", family: "monster", parts: figure, voxels: figure.voxelCount }]), [])
  assert.deepEqual(detailProblems([{ id: "wall", family: "building", parts: [{}, {}, {}] }]), [])
})
