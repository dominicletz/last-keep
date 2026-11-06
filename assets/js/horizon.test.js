import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { phash2, pictureCell } from "./horizon.js"

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
