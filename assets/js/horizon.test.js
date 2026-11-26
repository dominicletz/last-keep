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

test("undiscovered mist darkens mountain rock away from the day sky clear color", async () => {
  const { unseenMistHex } = await import("./horizon.js")
  const clear = [0x4e, 0x46, 0x51]
  const hex = unseenMistHex("day")
  const dark = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  assert.ok(luma(dark) < luma(clear) - 25, "unseen day mist should darken below sky luma")

  const root = new URL("../..", import.meta.url)
  const mountain = readRgbaPng(fs.readFileSync(new URL("priv/static/images/hd2d/ground-mountain.png", root)))
  let oldNear = 0
  let newNear = 0
  let total = 0
  for (let i = 0; i < mountain.rgba.length; i += 4 * 16) {
    total += 1
    const r = mountain.rgba[i]
    const g = mountain.rgba[i + 1]
    const b = mountain.rgba[i + 2]
    const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2])
    const oldMix = [r * 0.72 + clear[0] * 0.28, g * 0.72 + clear[1] * 0.28, b * 0.72 + clear[2] * 0.28]
    const newMix = [r * 0.72 + dark[0] * 0.28, g * 0.72 + dark[1] * 0.28, b * 0.72 + dark[2] * 0.28]
    if (dist(oldMix, clear) <= 18) oldNear += 1
    if (dist(newMix, clear) <= 18) newNear += 1
  }
  assert.ok(oldNear / total > 0.3, `expected sky-tinted mist to collapse mountain rock (${oldNear}/${total})`)
  assert.ok(newNear / total < 0.08, `darkened unseen mist should keep mountain rock clear of sky (${newNear}/${total})`)
})

test("outer horizon uses crisp pixel sampling and dims at dusk and night", async () => {
  const THREE = await import("three")
  const { horizonTintHex, mountPicture } = await import("./horizon.js")
  assert.equal(horizonTintHex("day"), 0xffffff)
  assert.ok(horizonTintHex("dusk") < 0xffffff)
  assert.ok(horizonTintHex("night") < horizonTintHex("dusk"))

  const scene = new THREE.Scene()
  const pic = mountPicture(scene, { loadMap: () => new THREE.Texture() })
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 400, 600)
  pic.sync({ seed: 7, attempt: 0, phase: "wave", hold: false, portals: [] }, camera, 168)

  const horizonMeshes = scene.children.filter((c) => c.userData.role === "horizon")
  assert.equal(horizonMeshes.length, 2)
  const map = horizonMeshes[0].material.map
  assert.ok(map.image.width >= 320, "horizon texture is sharper than the 256/6144 window")
  assert.equal(map.magFilter, THREE.NearestFilter)
  assert.equal(map.minFilter, THREE.NearestFilter)
  assert.ok(horizonMeshes[0].position.y < 0, "horizon sits below the yard to prevent seam z-fighting")

  const alphas = new Set()
  for (let i = 3; i < map.image.data.length; i += 4) alphas.add(map.image.data[i])
  assert.ok(alphas.size >= 4, "window map encodes distinct biome ids in alpha")

  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <project_vertex>",
    fragmentShader: "#include <common>\n#include <map_pars_fragment>\n#include <color_fragment>"
  }
  horizonMeshes[0].material.onBeforeCompile(shader)
  assert.ok(shader.uniforms.tileAtlas?.value, "shader binds tileAtlas")
  assert.equal(shader.uniforms.tileAtlas.value.image.width, 1024)
  assert.equal(shader.uniforms.tileAtlas.value.image.height, 512)
  assert.equal(shader.uniforms.tileAtlas.value.magFilter, THREE.NearestFilter)
  assert.ok(
    shader.fragmentShader.indexOf("#include <map_pars_fragment>") < shader.fragmentShader.indexOf("texture2D(map,"),
    "biomeIdAt references map only after map_pars_fragment declares it"
  )

  const pines = scene.children.filter((c) => c.userData.role === "far-pine")
  for (const pine of pines) {
    assert.equal(pine.material.color.getHex(), horizonTintHex("night"))
  }
})

test("coherent terrain keeps rivers blocked, fords open, and terrainWaypoint routes around rivers", async () => {
  const { biomeOpen, terrainWaypoint } = await import("./world_biome.js")
  assert.equal(biomeOpen(5, 0, 0, 0), true)
  // Find a blocked river cell and an open ford cell on seed 5
  let river = null
  let ford = null
  for (let i = -80; i <= 80 && (!river || !ford); i++) {
    for (let j = -80; j <= 80 && (!river || !ford); j++) {
      const x = i * 36
      const y = j * 36
      const b = pictureCell(5, 0, x, y)
      if (!river && b === "river") river = { x, y }
      if (!ford && b === "ford") ford = { x, y }
    }
  }
  assert.ok(river && ford, "seed 5 has both river and ford cells")
  assert.equal(biomeOpen(5, 0, river.x, river.y), false)
  assert.equal(biomeOpen(5, 0, ford.x, ford.y), true)
  const wp = terrainWaypoint(5, 0, 120, 0, 4140, 0)
  assert.equal(biomeOpen(5, 0, wp.x, wp.y), true)
  // Beside the seed-5 cliff edge (-2069.3, 56.6), terrainWaypoint must not cut north into {-57, 1}.
  const cliffWp = terrainWaypoint(5, 0, -2069.3, 56.6, -3852, -3384)
  assert.equal(biomeOpen(5, 0, cliffWp.x, cliffWp.y), true)
  assert.ok(cliffWp.y >= 54 || cliffWp.x < -2070, `waypoint should clear cliff south edge: ${JSON.stringify(cliffWp)}`)
})
