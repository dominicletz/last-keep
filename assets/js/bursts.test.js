import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { BURST_MS, BURST_SHEET, BURSTS, burstFrame, burstRow } from "./bursts.js"

test("boom, death, and slam are the three rows", () => {
  assert.deepEqual(BURSTS, ["boom", "death", "slam"])
  assert.equal(burstRow("boom"), 0)
  assert.equal(burstRow("death"), 1)
  assert.equal(burstRow("slam"), 2)
  assert.equal(burstRow("nova"), null)
})

test("the flipbook steps across 520 ms and holds the last frame", () => {
  assert.equal(BURST_MS, 520)
  assert.equal(burstFrame(0), 0)
  assert.equal(burstFrame(86), 0)
  assert.equal(burstFrame(87), 1)
  assert.equal(burstFrame(520 / 6), 1)
  assert.equal(burstFrame(519), 5)
  assert.equal(burstFrame(520), 5)
  assert.equal(burstFrame(800), 5)
})

test("bursts are a snapped flipbook, not a growing sphere", () => {
  const source = fs.readFileSync(new URL("./render.js", import.meta.url), "utf8")
  assert.equal(BURST_SHEET, "/images/hd2d/burst-sheet.png")
  assert.match(source, /sheetLoader\.load\(BURST_SHEET/)
  assert.match(source, /burstFrame\(ageMs\)/)
  assert.match(source, /burstRow\(burst\.kind\)/)
  assert.match(source, /snapWorld\(x, step\), 18, snapWorld\(z, step\)/)
  assert.doesNotMatch(source, /1 \+ age \* 3\.2/)
  assert.doesNotMatch(source, /0xff7a2a/)
})
