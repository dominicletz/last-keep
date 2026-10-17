import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius } from "../models/registry.js"
import { heroKinds, heroParts, heroSignature } from "./heroes.js"

test("each hero builds a distinct mesh signature", () => {
  const kinds = heroKinds()
  assert.deepEqual(kinds, ["warrior", "mage", "scout", "farmer", "engineer"])
  const sigs = kinds.map((kind) => heroSignature(kind))
  const keys = sigs.map((sig) => `${sig.marks.join("+")}|${sig.bounds.w}x${sig.bounds.h}x${sig.bounds.d}|${sig.parts.length}`)
  assert.equal(new Set(keys).size, kinds.length)
  assert.equal(new Set(sigs.map((sig) => sig.marks.join("+"))).size, kinds.length)
  assert.equal(new Set(sigs.map((sig) => `${sig.bounds.w}x${sig.bounds.h}x${sig.bounds.d}`)).size, kinds.length)
  const expected = {
    warrior: ["shoulders", "shield"],
    mage: ["robe", "hat", "staff"],
    scout: ["hood", "bow"],
    farmer: ["brim", "fork"],
    engineer: ["apron", "hammer"]
  }
  for (const sig of sigs) {
    assert.deepEqual(sig.marks, expected[sig.kind])
    assert.ok(sig.bounds.h >= 30, sig.kind)
    assert.ok(sig.bounds.w >= 14, sig.kind)
    const marked = sig.parts.filter((part) => part.mark)
    assert.ok(marked.every((part) => Math.max(part.w, part.h, part.d) >= 12), sig.kind)
  }
  const farmer = sigs.find((sig) => sig.kind === "farmer")
  const warrior = sigs.find((sig) => sig.kind === "warrior")
  const mage = sigs.find((sig) => sig.kind === "mage")
  const scout = sigs.find((sig) => sig.kind === "scout")
  assert.ok(farmer.bounds.w > warrior.bounds.w)
  assert.ok(mage.bounds.h > warrior.bounds.h)
  assert.ok(scout.bounds.w < warrior.bounds.w)
})

test("each hero wears the prop from the hero sheet", () => {
  const color = (kind, name) => heroParts(kind).find((part) => part.name === name).color
  assert.equal(color("warrior", "shield"), 0x38516f)
  assert.equal(color("warrior", "torso"), 0xb5afaa)
  assert.equal(color("mage", "gem"), 0x23d9f3)
  assert.equal(color("mage", "robe"), 0x142a48)
  assert.equal(color("scout", "hood"), 0x374a26)
  assert.equal(color("farmer", "brim"), 0xe5b268)
  assert.equal(color("engineer", "apron"), 0x472a17)
  for (const kind of heroKinds()) {
    assert.ok(horizontalRadius(heroParts(kind)) <= 14 * fitSlack, kind)
  }
})
