import assert from "node:assert/strict"
import test from "node:test"
import { frameFor, pixelSize } from "./frame.js"
import { viewScale } from "./town.js"

test("wide, square, and portrait windows keep square pixels and frame the yard", () => {
  for (const [width, height] of [
    [1600, 600],
    [1280, 800],
    [600, 1000]
  ]) {
    const frame = frameFor(width, height)
    const cssAspect = width / height
    assert.ok(Math.abs(frame.bufferWidth / frame.bufferHeight - cssAspect) < 0.05)
    assert.ok(Math.abs(frame.halfW / frame.halfH - frame.aspect) < 0.0001)
    assert.ok(frame.halfW >= 180)
    assert.equal(frame.right, frame.halfW)
    assert.equal(frame.top, frame.halfH)
  }
})

test("a world square keeps its aspect when the window aspect changes", () => {
  const wide = frameFor(1600, 600)
  const tall = frameFor(600, 1000)
  const wideScale = wide.bufferWidth / (wide.halfW * 2)
  const tallScale = tall.bufferHeight / (tall.halfH * 2)
  assert.ok(wideScale > 0)
  assert.ok(tallScale > 0)
  assert.ok(Math.abs(wide.bufferWidth / wide.bufferHeight - wide.aspect) < 0.0001)
  assert.ok(Math.abs(tall.bufferWidth / tall.bufferHeight - tall.aspect) < 0.0001)
})

test("the 1280 by 800 window is 640 by 400 internal pixels", () => {
  const frame = frameFor(1280, 800, 0)
  assert.equal(pixelSize, 2)
  assert.equal(frame.bufferWidth, 640)
  assert.equal(frame.bufferHeight, 400)
  assert.equal(frame.halfH, 168)
})

test("a higher town rank widens the same window", () => {
  const base = frameFor(1280, 800, 0)
  const raised = frameFor(1280, 800, 2)
  assert.ok(raised.halfH > base.halfH)
  assert.ok(Math.abs(raised.halfH / base.halfH - viewScale(2)) < 0.0001)
})
