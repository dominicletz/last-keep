import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, models } from "../models/registry.js"
import { heroCrops, conceptFigure } from "../models/sprites.js"
import { pictureColumn, spriteHeight } from "./pictures.js"
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
    assert.equal(sig.bounds.h, spriteHeight, sig.kind)
    assert.ok(sig.bounds.w >= 8 && sig.bounds.w <= 28, sig.kind)
    assert.equal(sig.parts[0].shape, "billboard")
    assert.equal(sig.parts[0].directions, 8)
    assert.equal(sig.parts[0].frames, 4)
  }
  const crops = heroCrops()
  for (const model of models()) {
    if (model.family !== "hero") continue
    assert.deepEqual(crops[model.id], model.concept.crop)
  }
  assert.equal(pictureColumn(Math.PI / 4, 0), 0)
  assert.notEqual(pictureColumn(Math.PI / 4, Math.PI / 4), 0)
  for (const kind of kinds) {
    const embedded = heroParts(kind)[0].image
    const crop = conceptFigure(kind)
    assert.equal(embedded.w, crop.w, kind)
    assert.equal(embedded.h, crop.h, kind)
    for (let i = 0; i < embedded.mask.length; i++) {
      assert.equal(embedded.mask[i], crop.mask[i], kind)
      if (!embedded.mask[i]) continue
      assert.equal(embedded.rgb[i * 3], crop.rgb[i * 3], kind)
      assert.equal(embedded.rgb[i * 3 + 1], crop.rgb[i * 3 + 1], kind)
      assert.equal(embedded.rgb[i * 3 + 2], crop.rgb[i * 3 + 2], kind)
    }
  }
})

test("each hero picture stays inside the gameplay radius", () => {
  for (const kind of heroKinds()) {
    assert.ok(horizontalRadius(heroParts(kind)) <= 14 * fitSlack, kind)
    const image = heroParts(kind)[0].image
    assert.ok(image.mask.some((bit) => bit), kind)
  }
})
