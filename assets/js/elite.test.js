import assert from "node:assert/strict"
import test from "node:test"
import { eliteLook } from "./elite.js"

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
