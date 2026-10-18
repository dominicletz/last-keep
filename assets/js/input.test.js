import assert from "node:assert/strict"
import test from "node:test"
import { axes, blurHiddenFocus, inputFrame, isTypingTarget, seatFromQuery } from "./input.js"

test("an invite with a name and hero is a seat", () => {
  assert.deepEqual(seatFromQuery("?name=LLL&hero=warrior"), { name: "LLL", hero: "warrior" })
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

test("a skill tap keeps its value if the socket sends it later", () => {
  const input = { mx: 0, my: 0, ax: 1, ay: 2, attack: false, place: false, raise: false, q: true, e: false, r: false, f: false, build: null }
  const frame = inputFrame(input)
  input.q = false
  input.attack = true
  assert.equal(frame.q, true)
  assert.equal(frame.attack, false)
  assert.equal(frame.ax, 1)
})

test("W moves toward the top of the isometric view", () => {
  const move = axes(new Set(["KeyW"]))
  assert.ok(move.x < 0)
  assert.ok(move.y < 0)
  assert.ok(Math.abs(move.x - move.y) < 1e-9)
})

test("held diagonals stay unit length", () => {
  const move = axes(new Set(["KeyW", "KeyD"]))
  assert.ok(Math.abs(Math.hypot(move.x, move.y) - 1) < 1e-9)
})
