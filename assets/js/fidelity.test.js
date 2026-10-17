import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { fidelityProblems, fidelityRows } from "./fidelity.js"

const backlog = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../playtests/BACKLOG.md"), "utf8")

const baseline = [
  ["mood", "2026-10-17", 1],
  ["town", "2026-10-17", 2],
  ["heroes", "2026-10-17", 2],
  ["monsters", "2026-10-17", 2],
  ["ui", "2026-10-17", 2]
]

test("the fidelity table keeps the round-5 baseline and rejects a silent drop", () => {
  const rows = fidelityRows(backlog)
  assert.deepEqual(fidelityProblems(rows), [])
  for (const [asset, date, score] of baseline) {
    const row = rows.find((item) => item.asset === asset && item.date === date && item.score === score)
    assert.ok(row, `${asset} baseline row is missing`)
    assert.ok(row.reason.trim().length > 0)
  }
  const drop = fidelityProblems([
    { asset: "mood", date: "2026-10-17", score: 2, reason: "olive daylight" },
    { asset: "mood", date: "2026-10-18", score: 1, reason: "" }
  ])
  assert.equal(drop.length, 1)
  const explained = fidelityProblems([
    { asset: "town", date: "2026-10-17", score: 2, reason: "box keep" },
    { asset: "town", date: "2026-10-18", score: 1, reason: "the keep lost its roof" }
  ])
  assert.deepEqual(explained, [])
  const rise = fidelityProblems([
    { asset: "ui", date: "2026-10-17", score: 2, reason: "panels" },
    { asset: "ui", date: "2026-10-18", score: 3, reason: "" }
  ])
  assert.deepEqual(rise, [])
})
