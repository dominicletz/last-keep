import assert from "node:assert/strict"
import test from "node:test"
import { CLOTH_HEIGHT, CLOTH_WIDTH, MARK_COLOR, layoutMapMarks } from "./map_cloth.js"

test("the map cloth draws one mark per discovered chunk", () => {
  const chunks = []
  for (let cx = -2; cx <= 2; cx++) {
    for (let cy = -2; cy <= 2; cy++) chunks.push({ cx, cy })
  }
  const initial = layoutMapMarks({ chunks, claimed: [{ cx: -2, cy: 0 }], portals: [{ cx: 2, cy: -1 }] })
  assert.equal(initial.count, 25)
  assert.equal(initial.marks.length, 25)

  // Every mark sits strictly inside the cloth bounds and leaves a gap between neighbors
  const seen = new Set()
  for (const mark of initial.marks) {
    assert.ok(Math.abs(mark.x) + mark.sx / 2 <= CLOTH_WIDTH / 2)
    assert.ok(Math.abs(mark.y) + mark.sy / 2 <= CLOTH_HEIGHT / 2)
    assert.ok(mark.sx > 0 && mark.sy > 0)
    seen.add(`${mark.cx},${mark.cy}`)
  }
  assert.equal(seen.size, 25)

  const keepMark = initial.marks.find((m) => m.cx === 0 && m.cy === 0)
  const claimedMark = initial.marks.find((m) => m.cx === -2 && m.cy === 0)
  const portalMark = initial.marks.find((m) => m.cx === 2 && m.cy === -1)
  const wildMark = initial.marks.find((m) => m.cx === 1 && m.cy === 1)
  assert.equal(keepMark.color, MARK_COLOR.keep)
  assert.equal(claimedMark.color, MARK_COLOR.claimed)
  assert.equal(portalMark.color, MARK_COLOR.portal)
  assert.equal(wildMark.color, MARK_COLOR.discovered)

  // Expanding to 40 discovered chunks adds 15 marks and changes the signature
  const more = chunks.slice()
  for (let cx = 3; cx <= 5; cx++) {
    for (let cy = -2; cy <= 2; cy++) more.push({ cx, cy })
  }
  const grown = layoutMapMarks({ chunks: more })
  assert.equal(grown.count, 40)
  assert.notEqual(grown.sig, initial.sig)

  // Out-of-bounds chunks are ignored and empty maps produce zero marks
  assert.equal(layoutMapMarks(null).count, 0)
  assert.equal(layoutMapMarks({ chunks: [{ cx: 99, cy: 0 }, { cx: 0, cy: 0 }] }).count, 1)
})
