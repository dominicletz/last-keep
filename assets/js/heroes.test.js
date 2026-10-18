import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, models } from "../models/registry.js"
import { heroCrops, conceptFigure } from "../models/sprites.js"
import { cardSourceHeight, pictureColumn, scaleFront, sheetRow, spriteHeight } from "./pictures.js"
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
    assert.equal(heroParts(sig.kind), sig.parts)
    assert.equal(sig.parts[0].shape, "billboard")
    assert.equal(sig.parts[0].directions, 8)
    assert.equal(sig.parts[0].frames, 11)
    assert.equal(sig.parts[0].walk, 4)
    assert.equal(sig.parts[0].attack, 3)
    assert.equal(sig.parts[0].death, 4)
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
    const crop = scaleFront(conceptFigure(kind), cardSourceHeight)
    assert.equal(embedded.h, cardSourceHeight, kind)
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

test("a hero sheet walks, strikes, and falls", () => {
  const picture = heroParts("warrior")[0]
  assert.equal(sheetRow(picture, {}, 0), 0)
  assert.equal(sheetRow(picture, { moving: true }, 160), 1)
  assert.equal(sheetRow(picture, { attackAt: 1000 }, 1000), 4)
  assert.equal(sheetRow(picture, { attackAt: 1000 }, 1140), 5)
  assert.equal(sheetRow(picture, { dead: true, deadAt: 0 }, 0), 7)
  assert.equal(sheetRow(picture, { dead: true, deadAt: 0 }, 480), 10)
  const top = (row) => {
    let n = 0
    const split = Math.floor(picture.cellH * 0.4)
    for (let y = 0; y < split; y++) {
      for (let x = 0; x < picture.cellW; x++) {
        const d = ((row * picture.cellH + y) * picture.atlasW + x) * 4 + 3
        if (picture.atlas[d]) n += 1
      }
    }
    return n
  }
  assert.ok(top(10) < top(0) * 0.5)
  assert.notEqual(top(5), top(0))
})

test("each hero picture stays inside the gameplay radius", () => {
  for (const kind of heroKinds()) {
    assert.ok(horizontalRadius(heroParts(kind)) <= 14 * fitSlack, kind)
    const image = heroParts(kind)[0].image
    assert.ok(image.mask.some((bit) => bit), kind)
  }
})
