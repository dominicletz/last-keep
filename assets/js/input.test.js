import assert from "node:assert/strict"
import test from "node:test"
import { axes, blurHiddenFocus, focusedAfterBlur, followKeys, inputFrame, isTypingTarget, keepSolid, keysAround, keysToward, retainFocus, seatFromQuery, shouldSend, swingFocus } from "./input.js"

test("an invite with a name and hero is a seat", () => {
  assert.deepEqual(seatFromQuery("?name=LLL&hero=warrior"), { name: "LLL", hero: "warrior" })
  assert.deepEqual(seatFromQuery("?hd2d=1&perf=1&name=Ada&hero=warrior"), { name: "Ada", hero: "warrior" })
})

test("a bare invite is not a seat", () => {
  assert.equal(seatFromQuery(""), null)
  assert.equal(seatFromQuery("?name=LLL"), null)
  assert.equal(seatFromQuery("?hero=warrior"), null)
  assert.equal(seatFromQuery("?name=LLL&hero=dragon"), null)
})

test("the seat name is trimmed to 16 characters", () => {
  const seat = seatFromQuery("?name=ABCDEFGHIJKLMNOPQRSTUVWXYZ&hero=mage")
  assert.equal(seat.name, "ABCDEFGHIJKLMNOP")
  assert.equal(seat.hero, "mage")
})

test("a hidden or non-text field does not count as typing", () => {
  const hidden = { tagName: "INPUT", type: "text", disabled: false, closest: () => ({}) }
  const visible = { tagName: "INPUT", type: "text", disabled: false, closest: () => null }
  const range = { tagName: "INPUT", type: "range", disabled: false, closest: () => null }
  const radio = { tagName: "INPUT", type: "radio", disabled: false, closest: () => null }
  assert.equal(isTypingTarget(hidden), false)
  assert.equal(isTypingTarget(visible), true)
  assert.equal(isTypingTarget(range), false)
  assert.equal(isTypingTarget(radio), false)
  assert.equal(isTypingTarget(null), false)
})

test("a blur that leaves the document focused does not drop the swing", () => {
  assert.equal(focusedAfterBlur(true), true)
  assert.equal(focusedAfterBlur(false), false)
  assert.equal(retainFocus(true, true), true)
  assert.equal(retainFocus(false, true), false)
  assert.equal(retainFocus(true, false), false)
  assert.equal(swingFocus(true, false, true), true)
  assert.equal(swingFocus(false, true, false), false)
})

test("blurring a hidden field does not chase focus", () => {
  const canvas = {
    focusCount: 0,
    focus() {
      this.focusCount += 1
      doc.activeElement = this
    }
  }
  const radio = {
    tagName: "INPUT",
    type: "radio",
    blurCount: 0,
    closest: () => ({}),
    blur() {
      this.blurCount += 1
      doc.activeElement = canvas
      blurHiddenFocus(doc)
    }
  }
  const name = {
    tagName: "INPUT",
    type: "text",
    blurCount: 0,
    closest: () => ({}),
    blur() {
      this.blurCount += 1
      doc.activeElement = radio
      blurHiddenFocus(doc)
    }
  }
  const doc = {
    activeElement: name,
    querySelector: () => canvas
  }
  assert.equal(blurHiddenFocus(doc), true)
  assert.equal(name.blurCount, 1)
  assert.equal(radio.blurCount, 1)
  assert.equal(canvas.focusCount, 1)
  assert.equal(blurHiddenFocus(doc), false)
})

test("a held skill is sent while a text field is focused", () => {
  assert.equal(shouldSend({ joined: true, typing: true, skill: true }), true)
  assert.equal(shouldSend({ joined: true, typing: true, skill: false }), false)
  assert.equal(shouldSend({ joined: false, typing: false, skill: true }), false)
  assert.equal(shouldSend({ joined: true, typing: false, skill: false }), true)
})

test("a skill tap keeps its value if the socket sends it later", () => {
  const input = { mx: 0, my: 0, ax: 1, ay: 2, attack: false, place: false, raise: false, q: true, e: false, r: false, f: false, build: null }
  const frame = inputFrame(input)
  input.q = false
  input.attack = true
  assert.equal(frame.q, true)
  assert.equal(frame.attack, false)
  assert.equal(frame.ax, 1)
})

test("closing on the host picks the movement keys that point that way", () => {
  assert.deepEqual(keysToward(0, 0), [])
  assert.deepEqual(keysToward(20, -10), [])
  const east = new Set(keysToward(190, -97))
  assert.equal(east.has("KeyD"), true)
  const step = axes(east)
  assert.ok(step.x > 0.5)
  assert.ok(step.y < 0)
})

test("W moves toward the top of the isometric view", () => {
  const move = axes(new Set(["KeyW"]))
  assert.ok(move.x < 0)
  assert.ok(move.y < 0)
  assert.ok(Math.abs(move.x - move.y) < 1e-9)
})

test("the keep face slides instead of holding due west", () => {
  const stuck = keysAround(73.5, 0, -400, 80)
  assert.notDeepEqual(stuck, ["KeyA", "KeyW"])
  assert.deepEqual(stuck, ["KeyS", "KeyA"])
  assert.deepEqual(keysAround(73.5, 0, 400, 0), ["KeyD", "KeyS"])
  assert.deepEqual(keysAround(0, -100, 40, -400), ["KeyW", "KeyD"])
  assert.deepEqual(keysAround(200, 0, -400, 0), ["KeyA", "KeyW"])
  assert.ok(keysAround(0, 200, 0, 230).length > 0)
})

test("held diagonals stay unit length", () => {
  const move = axes(new Set(["KeyW", "KeyD"]))
  assert.ok(Math.abs(Math.hypot(move.x, move.y) - 1) < 1e-9)
})

// One tick of a held step at the mage's speed, sliding on the keep disc.
function slideStep(at, keys, step = 7.4) {
  const move = axes(new Set(keys))
  const dx = move.x * step
  const dy = move.y * step
  const solid = (x, y) => keepSolid(x, y, at)
  if (!solid(at.x + dx, at.y + dy)) return { x: at.x + dx, y: at.y + dy }
  if (!solid(at.x + dx, at.y) && Math.abs(dx) > 0.2) return { x: at.x + dx, y: at.y }
  if (!solid(at.x, at.y + dy) && Math.abs(dy) > 0.2) return { x: at.x, y: at.y + dy }
  return at
}

function followFor(start, host, pick, ticks = 200) {
  let at = start
  for (let i = 0; i < ticks; i += 1) at = slideStep(at, pick(at, host))
  return at
}

// The live probe: the mage held into the keep at (-30, 62) while the host
// stood at (76, -44), so the keep sat on the line between them.
test("a guest behind the keep walks around it to the host", () => {
  const host = { x: 76, y: -44 }
  const line = followFor({ x: -30, y: 62 }, host, (at, goal) => keysToward(goal.x - at.x, goal.y - at.y))
  assert.ok(Math.hypot(host.x - line.x, host.y - line.y) > 100, `the straight line reached ${JSON.stringify(line)}`)
  for (const start of [{ x: -30, y: 62 }, { x: -120, y: 0 }, { x: -80, y: 90 }, { x: 0, y: 200 }]) {
    const end = followFor(start, host, followKeys)
    assert.ok(Math.hypot(host.x - end.x, host.y - end.y) <= 42 + 7.4, `from ${JSON.stringify(start)} stopped at ${JSON.stringify(end)}`)
  }
})

test("a guest beside the host holds no keys", () => {
  assert.deepEqual(followKeys({ x: 100, y: 0 }, { x: 120, y: 20 }), [])
  assert.ok(followKeys({ x: 300, y: 0 }, { x: 120, y: 20 }).length > 0)
})
