import assert from "node:assert/strict"
import test from "node:test"
import { extraSlots, LIVE_NON_DIEGETIC, NON_DIEGETIC } from "./ui.js"

const LOCKED = [
  "build-field",
  "build-forge",
  "build-mage_tower",
  "build-reason",
  "build-tower",
  "build-trap",
  "build-wall",
  "clock",
  "copy",
  "fallen",
  "forge",
  "hp",
  "keep",
  "mute",
  "next",
  "raise",
  "relics",
  "roster",
  "score",
  "skill-attack",
  "skill-e",
  "skill-q",
  "skill-r",
  "spire",
  "start",
  "stock",
  "volume",
  "wave"
]

test("the non-diegetic HUD stays inside the recorded list", () => {
  assert.equal(NON_DIEGETIC.length, 28)
  assert.deepEqual([...NON_DIEGETIC].sort(), LOCKED)
  assert.deepEqual(extraSlots(["wave", "coin-pouch"]), ["coin-pouch"])
  assert.equal(LIVE_NON_DIEGETIC.includes("fallen"), false)
  assert.equal(LIVE_NON_DIEGETIC.length, 27)
})
