import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { activeDrawMs, cameraFocus, cameraFollow, cameraLift, drawDue, frameFor, idleDrawMs, inputWindowMs, paintGap, pixelSize, slowPaintGapMs } from "./frame.js"
import { heroSignature } from "./heroes.js"
import { viewScale } from "./town.js"

test("a slow paint leaves a gap longer than the blend window", () => {
  assert.equal(paintGap(0), 0)
  assert.equal(paintGap(40), 0)
  assert.equal(paintGap(41), slowPaintGapMs)
  assert.ok(slowPaintGapMs > 45)
})

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

function project(focus, x, y, height = 16) {
  const frame = frameFor(1280, 800, 0)
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 2400)
  const dist = 150
  camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
  camera.lookAt(focus.x, cameraLift, focus.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return new THREE.Vector3(x, height, y).project(camera)
}

function onScreen(point) {
  return Math.abs(point.x) < 0.72 && Math.abs(point.y) < 0.62 && point.z < 1
}

test("a hero on the spawn ring stays in frame with the body under them", () => {
  const frame = frameFor(1280, 800, 0)
  const hero = { x: -455, y: 108 }
  const focus = cameraFocus(hero.x, hero.y)
  assert.equal(cameraFollow, 0.72)
  assert.ok(Math.hypot(hero.x - focus.x, hero.y - focus.z) < frame.halfH)
  const bats = [
    { x: -473, y: 128 },
    { x: -454, y: 142 }
  ]
  for (const bat of bats) assert.ok(onScreen(project(focus, bat.x, bat.y)), `${bat.x},${bat.y}`)
  const pulled = { x: hero.x * 0.22, z: hero.y * 0.22 }
  assert.ok(!onScreen(project(pulled, bats[0].x, bats[0].y)))
})

test("a hero on the join ring still frames a goblin across the keep", () => {
  const hero = { x: 21, y: -99 }
  assert.ok(onScreen(project(cameraFocus(hero.x, hero.y), -80, 90)))
  assert.ok(!onScreen(project({ x: hero.x, z: hero.y }, -80, 90)))
})

test("the scripted parade stays on screen around the host", () => {
  const frame = frameFor(1280, 800, 0)
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 2400)
  const hero = { x: 120, y: 0 }
  const focus = cameraFocus(hero.x, hero.y)
  const dist = 150
  camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
  camera.lookAt(focus.x, cameraLift, focus.z)
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
  const boss = new THREE.Vector3(-220, 16, -100).project(camera)
  assert.ok(Math.abs(boss.x) >= 0.72 || Math.abs(boss.y) >= 0.62)
})

test("a snapshot does not draw again until the page has had a turn", () => {
  assert.equal(activeDrawMs, 50)
  assert.equal(idleDrawMs, 250)
  assert.equal(inputWindowMs, 1500)
  assert.equal(drawDue(1000, 980, 900), false)
  assert.equal(drawDue(1000, 940, 900), true)
  assert.equal(drawDue(1000, 800, -600), false)
  assert.equal(drawDue(1000, 700, -600), true)
  assert.equal(drawDue(10_000, 0, -Infinity), true)
})

function topCss(camera, kind, x, z) {
  const sig = heroSignature(kind)
  const corner = new THREE.Vector3()
  let top = Infinity
  const consider = (wx, wy, wz) => {
    const point = corner.set(wx, wy, wz).project(camera)
    const css = (-point.y * 0.5 + 0.5) * 800
    if (css < top) top = css
  }
  for (const part of sig.parts) {
    const grow = part.hold ? 1.12 : 1
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          consider(
            x + part.x + sx * (part.w / 2) * grow,
            part.y + sy * (part.h / 2) * grow,
            z + part.z + sz * (part.d / 2) * grow
          )
        }
      }
    }
  }
  const barW = Math.max(22, sig.bounds.w * 0.45) / 2
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) consider(x + sx * barW, sig.bounds.h + 5.5, z + sz)
  }
  return top
}

function hostCamera(lift) {
  const frame = frameFor(1280, 800, 0)
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 2400)
  const focus = cameraFocus(120, 0)
  const dist = 150
  camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
  camera.lookAt(focus.x, lift, focus.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

test("a hero behind the host keeps their head in the frame", () => {
  assert.equal(cameraLift, 32)
  const angle = 2 * 2.2
  const x = Math.cos(angle) * 120
  const z = Math.sin(angle) * 120
  const framed = hostCamera(cameraLift)
  const grounded = hostCamera(0)
  let raisedMage = 0
  for (const kind of ["warrior", "mage", "scout", "farmer", "engineer"]) {
    const top = topCss(framed, kind, x, z)
    if (kind === "mage") raisedMage = top
    assert.ok(top > 48, `${kind} top ${top.toFixed(1)} sits on the edge`)
  }
  const groundedTop = topCss(grounded, "mage", x, z)
  assert.ok(groundedTop > 0, `ground look mage top ${groundedTop.toFixed(1)}`)
  assert.ok(raisedMage > groundedTop, `raised look ${raisedMage.toFixed(1)} is above the ground look ${groundedTop.toFixed(1)}`)
})

test("a higher town rank widens the same window", () => {
  const base = frameFor(1280, 800, 0)
  const raised = frameFor(1280, 800, 2)
  assert.ok(raised.halfH > base.halfH)
  assert.ok(Math.abs(raised.halfH / base.halfH - viewScale(2)) < 0.0001)
})
