import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { floraBands, floraCount, floraFree, floraLook, floraSlots } from "./flora.js"
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
