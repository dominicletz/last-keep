import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { deadTreeSlots, DEAD_TREE_CAP, floraBands, floraCount, floraFree, floraLook, floraSlots, RUIN_CAP, ruinSlots } from "./flora.js"
import { pictureCell } from "./horizon.js"
import { staticSheets, buildingSheet, floraSheets } from "./yard_cards.js"

test("the ring hash stays on the committed scatter", () => {
  const first = floraSlots(0, 0)[0]
  assert.equal(first.kind, "bush")
  assert.ok(Math.abs(first.x - -76.56991260891466) < 1e-9)
  assert.ok(Math.abs(first.z - 188.6532459516072) < 1e-9)
})

test("flora is the same for a seed and attempt, and moves with either", () => {
  assert.deepEqual(floraSlots(7, 0), floraSlots(7, 0))
  assert.notDeepEqual(floraSlots(7, 0), floraSlots(8, 0))
  assert.notDeepEqual(floraSlots(7, 0), floraSlots(7, 1))
  assert.deepEqual(floraSlots(), floraSlots(1, 0))
})

test("every seed scatters the same fixed count of each kind, so one sprite pool serves all", () => {
  for (const seed of [1, 2, 99, 123456, -5]) {
    const slots = floraSlots(seed, 3)
    assert.equal(slots.length, floraCount)
    for (const [kind, look] of Object.entries(floraLook)) {
      assert.equal(slots.filter((s) => s.kind === kind).length, look.yard + look.edge, kind)
      for (const s of slots.filter((s) => s.kind === kind)) assert.ok(look.variants.includes(s.variant))
    }
  }
  assert.ok(floraCount <= 64, "kept cheap: at most 64 sprites")
})

test("flora stays off the plaza and the four roads, inside the yard and forest edge", () => {
  const far = floraBands.edge.far
  for (let seed = 0; seed < 40; seed++) {
    for (const s of floraSlots(seed, 0)) {
      assert.ok(floraFree(s.x, s.z), `${seed} ${s.kind} ${s.x},${s.z}`)
      assert.ok(Math.hypot(s.x, s.z) <= far + 1e-9)
    }
  }
  assert.equal(floraFree(0, 0), false)
  assert.equal(floraFree(200, 0), false) // on the east road
  assert.equal(floraFree(170, 170), true)
  assert.equal(floraFree(150, 150), false) // the plaza corner
})

test("each kind uses every variant over a few seeds", () => {
  const seen = new Set()
  for (let seed = 0; seed < 12; seed++) for (const s of floraSlots(seed, 0)) seen.add(`${s.kind}-${s.variant}`)
  assert.equal(seen.size, Object.values(floraLook).reduce((n, look) => n + look.variants.length, 0))
})

test("ruin stones sit on ruins cells outside the yard and stay capped", () => {
  const slots = ruinSlots(7, 0, 0, 0, 2400)
  assert.equal(RUIN_CAP, 24)
  assert.ok(slots.length > 0 && slots.length <= RUIN_CAP)
  const variants = new Set()
  for (const slot of slots) {
    assert.equal(slot.kind, "ruin_stones")
    assert.equal(slot.y, 8)
    assert.ok(!(Math.abs(slot.x) < 380 && Math.abs(slot.z) < 380))
    assert.ok(Math.hypot(slot.x, slot.z) <= 2400)
    assert.equal(pictureCell(7, 0, slot.x, slot.z), "ruins")
    assert.ok(["a", "b", "c"].includes(slot.variant))
    variants.add(slot.variant)
  }
  assert.equal(variants.size, 3)
  assert.deepEqual(ruinSlots(7, 0, 0, 0, 2400), slots)
  assert.notDeepEqual(ruinSlots(8, 0, 0, 0, 2400), slots)
  assert.equal(floraCount, 64)
})

test("dead trees take the next ruins cells and stand on the same lift", () => {
  const stones = ruinSlots(7, 0, 0, 0, 2400)
  const trees = deadTreeSlots(7, 0, 0, 0, 2400)
  assert.equal(DEAD_TREE_CAP, 6)
  assert.equal(trees.length, DEAD_TREE_CAP)
  const taken = new Set(stones.map((slot) => `${slot.x},${slot.z}`))
  for (const slot of trees) {
    assert.equal(slot.kind, "dead_tree")
    assert.equal(slot.variant, "a")
    assert.equal(slot.y, 8)
    assert.ok(!(Math.abs(slot.x) < 380 && Math.abs(slot.z) < 380))
    assert.ok(Math.hypot(slot.x, slot.z) <= 2400)
    assert.equal(pictureCell(7, 0, slot.x, slot.z), "ruins")
    assert.equal(taken.has(`${slot.x},${slot.z}`), false)
    taken.add(`${slot.x},${slot.z}`)
  }
  assert.equal(taken.size, stones.length + trees.length)
  assert.deepEqual(deadTreeSlots(7, 0, 0, 0, 2400), trees)
  assert.notDeepEqual(deadTreeSlots(8, 0, 0, 0, 2400), trees)
  assert.notDeepEqual(deadTreeSlots(7, 1, 0, 0, 2400), trees)
})

test("the yard draws ruin stones from their sheet and the map table is a sprite under the cloth", () => {
  const src = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  assert.match(src, /placeRuins\(Number\.isInteger\(snap && snap\.seed\)/)
  assert.match(src, /placeDeadTrees\(Number\.isInteger\(snap && snap\.seed\)/)
  assert.match(src, /staticMats\.ruin_stones\[slot\.variant\]/)
  assert.match(src, /staticMats\.dead_tree\[slot\.variant\]/)
  assert.match(src, /staticCard\("dead_tree", slot\.variant\)/)
  assert.match(src, /flatMats\[sheetKind\]\[variant\]/)
  assert.match(src, /spec\.stand === false/)
  assert.doesNotMatch(src, /staticMats\.field/)
  assert.doesNotMatch(src, /staticMats\.forest_barrier/)
  assert.doesNotMatch(src, /staticMats\.cliff_face/)
  assert.doesNotMatch(src, /staticMats\.reeds/)
  assert.doesNotMatch(src, /portal-sheet/)
  assert.doesNotMatch(src, /rabbit/)
  assert.doesNotMatch(src, /hermit/)
  assert.doesNotMatch(src, /sync\("merchant"/)
  assert.doesNotMatch(src, /staticMats\.hell_door/)
  assert.match(src, /const card = new THREE\.Mesh\(geometry, material\)/)
  assert.ok(src.indexOf("const cardFacing = new THREE.Vector3()") < src.indexOf("return viewApi"))
  for (const name of ["portal-sheet.png", "reeds-sheet.png", "forest_barrier-sheet.png"]) {
    assert.equal(fs.existsSync(new URL(`../../priv/static/images/hd2d/${name}`, import.meta.url)), false, name)
  }
  assert.match(src, /staticCard\("map_table", "a"\)/)
  assert.match(src, /new THREE\.Sprite\(staticMats\.map_table\.a\)/)
  assert.match(src, /mapTable\.position\.set\(0, 0, 160\)/)
  assert.match(src, /mapCloth\.position\.set\(0, 13\.2, 160\)/)
  assert.match(src, /paintMapCloth\(mapCloth/)
  assert.doesNotMatch(src, /BoxGeometry\(36, 8, 22\)/)
  assert.match(src, /sync\("spot", snap\.pois \|\| \[\]/)
  assert.match(src, /spotVariant\(row\.kind, row\.id\)/)
  assert.match(src, /new THREE\.Sprite\(staticMats\[row\.kind\]\[variant\]\)/)
  assert.match(src, /mesh\.center\.set\(0\.5, art\.centerY\)/)
})

test("flora draws its static sheets from a pooled set of sprites, not buildings", () => {
  assert.deepEqual(floraSheets, Object.keys(floraLook))
  for (const kind of floraSheets) {
    assert.deepEqual(staticSheets[kind].variants, floraLook[kind].variants, kind)
    assert.equal(buildingSheet(kind), null)
  }
  const src = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  assert.match(src, /if \(key === floraKey\) return/)
  assert.match(src, /new THREE\.Sprite\(staticMats\[slot\.kind\]\[slot\.variant\]\)/)
})
