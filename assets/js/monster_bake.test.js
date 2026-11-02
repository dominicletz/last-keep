import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { readAtlasPng, sheetMeta, writeAtlasPng } from "./monster_bake.js"
import { monsterSheets } from "./monster-sheets.js"
import { bakeMonster, monsterKinds, monsterSheetUrl } from "./monsters.js"

const staticRoot = new URL("../../priv/static", import.meta.url)

function committed(kind) {
  return readAtlasPng(readFileSync(new URL(`.${monsterSheetUrl(kind)}`, `${staticRoot.href}/`)))
}

// The browser shows these PNGs instead of baking. They must be the bake.
test("each committed monster sheet is the palette-locked atlas, pixel for pixel", () => {
  for (const kind of monsterKinds()) {
    const parts = bakeMonster(kind)
    const card = parts[0]
    const sheet = committed(kind)
    assert.equal(sheet.width, card.atlasW, kind)
    assert.equal(sheet.height, card.atlasH, kind)
    assert.ok(Buffer.from(sheet.atlas).equals(Buffer.from(card.atlas)), `${kind} sheet drifted: run node script/bake_monsters.mjs`)
    assert.deepEqual(monsterSheets[kind], JSON.parse(JSON.stringify(sheetMeta(parts))), `${kind} sheet table drifted`)
  }
})

test("a palette sheet round-trips clear and opaque pixels", () => {
  const atlas = new Uint8Array([0, 0, 0, 0, 10, 20, 30, 255, 10, 20, 30, 255, 200, 1, 2, 255])
  const png = writeAtlasPng(atlas, 2, 2)
  assert.deepEqual(readAtlasPng(png), { atlas, width: 2, height: 2 })
  assert.throws(() => writeAtlasPng(new Uint8Array([1, 2, 3, 128]), 1, 1), /clear black or opaque/)
})

async function freshMonsters(tag) {
  return import(`./monsters.js?${tag}`)
}

function served(kinds) {
  const calls = []
  const fetch = async (url) => {
    calls.push(url)
    const kind = url.split("/").pop().replace(".png", "")
    if (!kinds.includes(kind)) return { ok: false, status: 404 }
    return { ok: true, blob: async () => kind }
  }
  const decode = async (kind) => committed(kind).atlas
  return { calls, fetch, decode }
}

test("a loaded sheet becomes the kind's card without a bake", async () => {
  const monsters = await freshMonsters("sheets")
  const net = served(monsters.monsterKinds())
  const adopted = await monsters.loadMonsterSheets(net)
  assert.equal(adopted, monsters.monsterKinds().length)
  assert.deepEqual(net.calls, monsters.monsterKinds().map((kind) => `/images/hd2d/monsters/${kind}.png`))
  for (const kind of monsters.monsterKinds()) {
    const parts = monsters.monsterParts(kind)
    assert.equal(monsters.monsterSource(kind), "sheet", kind)
    const baked = bakeMonster(kind)
    const { image: _shown, ...shown } = baked[0]
    assert.deepEqual({ ...parts[0], atlas: null }, { ...shown, atlas: null }, kind)
    assert.deepEqual(parts.marks, baked.marks)
    assert.equal(parts.voxelCount, baked.voxelCount)
    assert.deepEqual(parts.bounds, baked.bounds)
    assert.equal(monsters.monsterParts(kind), parts, kind)
  }
  // A second load finds every kind in place and fetches nothing.
  const again = served(monsters.monsterKinds())
  assert.equal(await monsters.loadMonsterSheets(again), 0)
  assert.deepEqual(again.calls, [])
})

test("a missing sheet leaves its kind to the in-page bake", async () => {
  const monsters = await freshMonsters("missing")
  const warn = console.warn
  const warned = []
  console.warn = (line) => warned.push(line)
  try {
    const adopted = await monsters.loadMonsterSheets(served(["wolf"]))
    assert.equal(adopted, 1)
  } finally {
    console.warn = warn
  }
  assert.equal(warned.length, monsters.monsterKinds().length - 1)
  assert.equal(monsters.monsterSource("wolf"), "sheet")
  assert.equal(monsters.monsterSource("goblin"), null)
  const goblin = monsters.monsterParts("goblin")
  assert.equal(monsters.monsterSource("goblin"), "baked")
  assert.equal(goblin[0].atlasLocked, true)
  assert.ok(Buffer.from(goblin[0].atlas).equals(Buffer.from(committed("goblin").atlas)))
})

test("loading the monster module bakes nothing", async () => {
  const started = performance.now()
  const monsters = await freshMonsters("cold")
  assert.equal(monsters.monsterSource("goblin"), null)
  assert.ok(performance.now() - started < 400, "import should not bake the atlases")
})
