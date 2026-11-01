import assert from "node:assert/strict"
import test from "node:test"
import { tierFor } from "./hd2d/tier.js"
import { acceptWord, classFromKey, menuEnv, stepClass } from "./start_pick.js"

test("class steps wrap and a typed name keeps A and D", () => {
  assert.equal(stepClass(0, -1, 5), 4)
  assert.equal(stepClass(4, 1, 5), 0)
  assert.equal(classFromKey("ArrowRight", false), 1)
  assert.equal(classFromKey("KeyA", false), -1)
  assert.equal(classFromKey("KeyA", true), 0)
  assert.equal(classFromKey("KeyW", false), 0)
  assert.equal(acceptWord("create"), "Create")
  assert.equal(acceptWord("join"), "Join")
})

test("the menu picture is the low tier on a strong device", () => {
  const env = menuEnv({ hardwareConcurrency: 16, deviceMemory: 16, width: 1280, height: 800 })
  assert.equal(tierFor(env), "low")
  assert.equal(env.hardwareConcurrency, 2)
})
