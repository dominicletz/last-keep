import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { biomeColor, phash2, pictureCell } from "./horizon.js"
import { GROUND_TILE_URLS, sampleGroundTile } from "./seam_tiles.js"
import { readRgbaPng } from "./hd2d/png.js"
import { seamHolds } from "./ground.js"

test("phash2 matches erlang for integer tuples", () => {
  assert.equal(phash2([1, 0, 0, 0]), 6151981)
  assert.equal(phash2([5, 12, -3, 1]), 95894455)
  assert.equal(phash2([1, 100, 100, 0]), 36095079)
})

test("pictureCell matches the committed fixture", () => {
  const rows = JSON.parse(
    fs.readFileSync(new URL("../../test/fixtures/horizon_picture.json", import.meta.url), "utf8")
  )
  assert.ok(rows.length >= 5)
  for (const row of rows) {
    assert.equal(pictureCell(row.seed, row.attempt, row.x, row.y), row.biome, JSON.stringify(row))
  }
  for (const [x, y] of [
    [0, 0],
    [432, 0],
    [800, 0],
    [2000, 0]
  ]) {
    assert.ok(rows.some((row) => row.seed === 1 && row.x === x && row.y === y))
  }
  assert.ok(rows.some((row) => row.seed === 1 && Math.hypot(row.x, row.y) > 7200))
})

test("meadow, ruins, pine, cliff and river sample the passing tiles", () => {
  const root = new URL("../..", import.meta.url)
  const read = (rel) => readRgbaPng(fs.readFileSync(new URL(rel, root)))
  for (const rel of [
    "priv/static/images/hd2d/ground-yard-grass.png",
    "priv/static/images/hd2d/ground-meadow.png",
    "priv/static/images/hd2d/ground-ruins.png",
    "priv/static/images/hd2d/ground-pine.png",
    "priv/static/images/hd2d/ground-cliff.png",
    "priv/static/images/hd2d/ground-river.png",
    "priv/static/images/hd2d/ground-ford.png",
    "priv/static/images/hd2d/ground-dirt.png",
    "priv/static/images/hd2d/ground-hill.png",
    "priv/static/images/hd2d/ground-mountain.png"
  ]) {
    const image = read(rel)
    assert.equal(seamHolds(image.rgba, image.width, image.height), true, rel)
  }
  const meadow = sampleGroundTile("meadow", 800, 0)
  const ruins = sampleGroundTile("ruins", 2000, 0)
  const pine = sampleGroundTile("pine", 0, 0)
  const cliff = sampleGroundTile("cliff", 0, 0)
  assert.ok(meadow)
  assert.ok(ruins)
  assert.ok(pine)
  assert.ok(cliff)
  assert.deepEqual(biomeColor("meadow", 800, 0), meadow)
  assert.deepEqual(biomeColor("ford", 432, 0), sampleGroundTile("ford", 432, 0))
  assert.deepEqual(biomeColor("hill", 900, 40), sampleGroundTile("hill", 900, 40))
  assert.deepEqual(biomeColor("mountain", 1400, 20), sampleGroundTile("mountain", 1400, 20))
  assert.deepEqual(biomeColor("ruins", 2000, 0), ruins)
  assert.deepEqual(biomeColor("pine", 120, 40), sampleGroundTile("pine", 120, 40))
  assert.deepEqual(biomeColor("cliff", 80, 20), sampleGroundTile("cliff", 80, 20))
  assert.deepEqual(biomeColor("river", 0, 0), sampleGroundTile("river", 0, 0))
  assert.equal(GROUND_TILE_URLS.river, "/images/hd2d/ground-river.png")
  assert.equal(GROUND_TILE_URLS.ford, "/images/hd2d/ground-ford.png")
  assert.equal(GROUND_TILE_URLS.dirt, "/images/hd2d/ground-dirt.png")
  assert.equal(GROUND_TILE_URLS.hill, "/images/hd2d/ground-hill.png")
  assert.equal(GROUND_TILE_URLS.mountain, "/images/hd2d/ground-mountain.png")
  for (const held of ["plaza", "path"]) {
    assert.equal(GROUND_TILE_URLS[held], undefined, held)
  }
  assert.equal(pictureCell(1, 0, 0, 0), "meadow")
})

test("far pines: capped, outside the yard, on pine cells, stable and both variants", async () => {
  const { farPines, FAR_PINE_CAP } = await import("./horizon.js")
  const picks = farPines(7, 0, 0, 0, 2400)
  assert.equal(FAR_PINE_CAP, 180)
  assert.ok(picks.length > 0 && picks.length <= 180)
  for (const t of picks) {
    assert.ok(!(Math.abs(t.x) < 380 && Math.abs(t.z) < 380))
    assert.equal(pictureCell(7, 0, t.x, t.z), "pine")
    assert.ok(["a", "b"].includes(t.variant))
  }
  assert.deepEqual(new Set(picks.map((t) => t.variant)), new Set(["a", "b"]))
  assert.deepEqual(farPines(7, 0, 0, 0, 2400), picks)
})

test("far pines draw as pine-sheet quads: two instanced meshes, two triangles a tree", async () => {
  const THREE = await import("three")
  const { mountPicture } = await import("./horizon.js")
  const scene = new THREE.Scene()
  const urls = []
  const pic = mountPicture(scene, { loadMap: (u) => (urls.push(u), new THREE.Texture()) })
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 400, 600)
  pic.sync({ seed: 7, attempt: 0, portals: [] }, camera, 168)
  const pines = scene.children.filter((c) => c.userData.role === "far-pine")
  assert.equal(pines.length, 2)
  assert.deepEqual(urls, ["/images/hd2d/pine-sheet.png", "/images/hd2d/pine-sheet.png"])
  let total = 0
  for (const m of pines) {
    assert.ok(m.isInstancedMesh)
    assert.equal(m.geometry.index.count / 3, 2)
    assert.ok(m.material.map && m.material.alphaTest === 0.5 && !m.material.transparent)
    total += m.count
  }
  assert.ok(total > 0 && total <= 180)
})
