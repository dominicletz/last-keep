import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { ELITE_MARKS, ELITE_MARK_CELL, ELITE_MARK_SHEET, eliteLook, eliteMark } from "./elite.js"

test("a boss, an armored elite, a fast elite, and an enraged elite do not share a look", () => {
  const looks = [
    eliteLook({ kind: "boss" }),
    eliteLook({ kind: "goblin", elite: "armored" }),
    eliteLook({ kind: "goblin", elite: "fast" }),
    eliteLook({ kind: "goblin", elite: "enraged" }),
    eliteLook({ kind: "goblin" })
  ]
  assert.deepEqual(looks, ["horned", "plated", "lean", "spiked", "plain"])
  assert.equal(new Set(looks).size, looks.length)
})

test("only plated, lean, and spiked get a mark, and it is the matching cell", () => {
  assert.deepEqual(eliteMark({ kind: "goblin", elite: "armored" }), { look: "plated", index: 0 })
  assert.deepEqual(eliteMark({ kind: "wolf", elite: "fast" }), { look: "lean", index: 1 })
  assert.deepEqual(eliteMark({ kind: "troll", elite: "enraged" }), { look: "spiked", index: 2 })
  assert.equal(eliteMark({ kind: "goblin" }), null)
  assert.equal(eliteMark({ kind: "boss" }), null)
  assert.equal(eliteMark({ kind: "boss", elite: "armored" }), null)
  assert.deepEqual(ELITE_MARKS, ["plated", "lean", "spiked"])
  assert.deepEqual(ELITE_MARK_CELL, { w: 24, h: 24 })
})

test("the renderer draws the mark sheet above the bar and not the old box", () => {
  assert.equal(ELITE_MARK_SHEET, "/images/hd2d/elite-marks.png")
  const source = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  assert.match(source, /sheetLoader\.load\(ELITE_MARK_SHEET\)/)
  assert.match(source, /eliteMark\(row\)/)
  assert.match(source, /icon\.position\.y = picture\.h \+ 6/)
  assert.match(source, /userData\.mark/)
  assert.doesNotMatch(source, /BoxGeometry\(5, 8, 5\)/)
})
