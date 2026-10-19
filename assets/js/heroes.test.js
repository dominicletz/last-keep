import assert from "node:assert/strict"
import test from "node:test"
import { fitSlack, horizontalRadius, models } from "../models/registry.js"
import { gameFrame, renderParts } from "../models/raster.js"
import { heroCrops, conceptFigure } from "../models/sprites.js"
import { heroReadabilityFloor, readability } from "./art_score.js"
import { groundPixels } from "./ground.js"
import { cardSourceHeight, pictureColumn, scaleFront, sheetRow, spriteHeight } from "./pictures.js"
import { heroKinds, heroParts, heroSignature } from "./heroes.js"
import { groundUnderMask } from "./yard_sample.js"

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

test("a hero side view keeps the gear a center slice drops", () => {
  const column = (picture, dir) => {
    const rgb = new Uint8Array(picture.cellW * picture.cellH * 3)
    const mask = new Uint8Array(picture.cellW * picture.cellH)
    for (let y = 0; y < picture.cellH; y++) {
      for (let x = 0; x < picture.cellW; x++) {
        const s = (y * picture.atlasW + dir * picture.cellW + x) * 4
        if (!picture.atlas[s + 3]) continue
        const d = y * picture.cellW + x
        mask[d] = 1
        rgb[d * 3] = picture.atlas[s]
        rgb[d * 3 + 1] = picture.atlas[s + 1]
        rgb[d * 3 + 2] = picture.atlas[s + 2]
      }
    }
    return { rgb, mask, w: picture.cellW, h: picture.cellH }
  }
  const inkWidth = (image) => {
    let min = image.w
    let max = -1
    for (let i = 0; i < image.mask.length; i++) {
      if (!image.mask[i]) continue
      const x = i % image.w
      if (x < min) min = x
      if (x > max) max = x
    }
    return max < 0 ? 0 : max - min + 1
  }
  const nearSide = (image, r, g, b) => {
    let left = 0
    let right = 0
    const limit = 36 * 36
    for (let i = 0; i < image.mask.length; i++) {
      if (!image.mask[i]) continue
      const dr = image.rgb[i * 3] - r
      const dg = image.rgb[i * 3 + 1] - g
      const db = image.rgb[i * 3 + 2] - b
      if (dr * dr + dg * dg + db * db > limit) continue
      if (i % image.w < image.w / 2) left += 1
      else right += 1
    }
    return { left, right, n: left + right }
  }
  for (const kind of heroKinds()) {
    const picture = heroParts(kind)[0]
    const ratio = inkWidth(column(picture, 2)) / inkWidth(column(picture, 0))
    assert.ok(ratio >= 0.32 && ratio <= 0.62, `${kind} side ratio ${ratio}`)
  }
  const warrior = heroParts("warrior")[0]
  const side = nearSide(column(warrior, 2), 0x38, 0x51, 0x6f)
  const turned = nearSide(column(warrior, 6), 0x38, 0x51, 0x6f)
  assert.ok(side.n >= 80, side.n)
  assert.ok(side.right > side.left * 4, side)
  assert.ok(turned.left > turned.right * 4, turned)
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

test("each hero reads against the path and the grass at the gameplay camera", () => {
  assert.equal(heroReadabilityFloor.height, 32)
  assert.equal(heroReadabilityFloor.contrast, 29)
  const grounds = {}
  for (const phase of ["day", "dusk", "night"]) grounds[phase] = groundPixels(phase)
  const { frame, camera } = gameFrame(0)
  let shortest = Infinity
  let quietest = Infinity
  for (const kind of heroKinds()) {
    const base = heroParts(kind)
    for (const [x, z] of [
      [160, 0],
      [160, 80]
    ]) {
      const parts = base.map((part) => ({ ...part, x, z }))
      for (const light of ["day", "dusk", "night"]) {
        const image = renderParts(parts, light, 0)
        const rgb = groundUnderMask(image, camera, frame, grounds[light])
        const read = readability(image, { rgb, width: image.width, height: image.height })
        assert.ok(read.height >= heroReadabilityFloor.height, `${kind} ${light} is ${read.height}px`)
        assert.ok(read.contrast >= heroReadabilityFloor.contrast, `${kind} ${x},${z} ${light} contrast ${read.contrast}`)
        if (read.height < shortest) shortest = read.height
        if (read.contrast < quietest) quietest = read.contrast
      }
    }
  }
  assert.ok(heroReadabilityFloor.height >= shortest * 0.5, `height floor is under half of ${shortest}`)
  assert.ok(heroReadabilityFloor.contrast >= quietest * 0.5, `contrast floor is under half of ${quietest}`)
})

test("each hero picture stays inside the gameplay radius", () => {
  for (const kind of heroKinds()) {
    assert.ok(horizontalRadius(heroParts(kind)) <= 14 * fitSlack, kind)
    const image = heroParts(kind)[0].image
    assert.ok(image.mask.some((bit) => bit), kind)
  }
})
