import assert from "node:assert/strict"
import test from "node:test"
import { present } from "./present.js"

test("a goblin in the snapshot is a monster to draw", () => {
  const view = present({
    players: [{ id: "p1", hero: "warrior", x: 10, y: 20, facing: 0, hp: 100, max: 150 }],
    monsters: [{ id: 4, kind: "goblin", x: 360, y: -40, facing: 1, hp: 28, max: 28 }],
    buildings: []
  })
  assert.equal(view.monsters.length, 1)
  assert.equal(view.monsters[0].kind, "goblin")
  assert.equal(view.monsters[0].x, 360)
  assert.equal(view.monsters[0].y, -40)
  assert.equal(view.heroes[0].id, "p1")
})

test("a snapshot without monsters draws none", () => {
  assert.deepEqual(present({ players: [], buildings: [] }).monsters, [])
  assert.deepEqual(present(null).monsters, [])
})

test("a monster without a facing still gets a real rotation", () => {
  const view = present({ monsters: [{ id: 2, kind: "goblin", x: 180, y: 20, hp: 28, max: 28 }] })
  assert.equal(Number.isFinite(view.monsters[0].facing), true)
})

test("an elite keeps the mark the renderer uses", () => {
  const view = present({
    monsters: [{ id: 9, kind: "boss", x: 40, y: 10, elite: "armored", hp: 80, max: 80 }]
  })
  assert.equal(view.monsters[0].kind, "boss")
  assert.equal(view.monsters[0].elite, "armored")
})

test("a monster with a bad position is not drawn", () => {
  const view = present({ monsters: [{ id: 1, kind: "goblin", x: null, y: 10 }] })
  assert.deepEqual(view.monsters, [])
})
