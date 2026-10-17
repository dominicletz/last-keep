import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"
import { fidelityViolations, parseFidelityTable } from "./fidelity.js"

test("a fidelity score cannot fall without a recorded reason", () => {
  assert.deepEqual(
    fidelityViolations([
      { asset: "hero-warrior", score: 4, reason: "" },
      { asset: "hero-warrior", score: 3, reason: "" }
    ]),
    ["hero-warrior"]
  )
  assert.deepEqual(
    fidelityViolations([
      { asset: "hero-warrior", score: 4, reason: "" },
      { asset: "hero-warrior", score: 3, reason: "shield reads smaller at game zoom" }
    ]),
    []
  )
  assert.deepEqual(
    fidelityViolations([
      { asset: "hero-mage", score: 2, reason: "" },
      { asset: "hero-mage", score: 4, reason: "" }
    ]),
    []
  )
})

test("the backlog fidelity table has not regressed", () => {
  const markdown = fs.readFileSync(new URL("../../playtests/BACKLOG.md", import.meta.url), "utf8")
  assert.deepEqual(fidelityViolations(parseFidelityTable(markdown)), [])
})
