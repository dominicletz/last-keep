import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { cameraFocus, frameFor, pixelSize } from "./frame.js"
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

test("a hero on the spawn ring stays in frame with the body under them", () => {
  const frame = frameFor(1280, 800, 0)
  const hero = { x: -455, y: 108 }
  const focus = cameraFocus(hero.x, hero.y)
  assert.ok(Math.hypot(hero.x - focus.x, hero.y - focus.z) < frame.halfW * 0.35)
  const bat = { x: -473, y: 128 }
  assert.ok(Math.hypot(bat.x - focus.x, bat.y - focus.z) < frame.halfH)
  const pulled = { x: hero.x * 0.22, z: hero.y * 0.22 }
  assert.ok(Math.hypot(bat.x - pulled.x, bat.y - pulled.z) > frame.halfW)
})

test("the scripted parade stays on screen around the host", () => {
  const frame = frameFor(1280, 800, 0)
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 2400)
  const hero = { x: 120, y: 0 }
  const focus = cameraFocus(hero.x, hero.y)
  const dist = 150
  camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
  camera.lookAt(focus.x, 0, focus.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  const parade = [
    [120, -55],
    [167.63, -27.5],
    [167.63, 27.5],
    [120, 55],
    [72.37, 27.5],
    [72.37, -27.5]
  ]
  for (const [x, y] of parade) {
    const point = new THREE.Vector3(x, 16, y).project(camera)
    assert.ok(Math.abs(point.x) < 0.72)
    assert.ok(Math.abs(point.y) < 0.62)
    assert.ok(point.z < 1)
  }
  const troll = new THREE.Vector3(-40, 16, 120).project(camera)
  assert.ok(Math.abs(troll.x) >= 0.72 || Math.abs(troll.y) >= 0.62)
})

test("a higher town rank widens the same window", () => {
  const base = frameFor(1280, 800, 0)
  const raised = frameFor(1280, 800, 2)
  assert.ok(raised.halfH > base.halfH)
  assert.ok(Math.abs(raised.halfH / base.halfH - viewScale(2)) < 0.0001)
})
