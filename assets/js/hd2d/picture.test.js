import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { pixelStep } from "../art_score.js"
import { cameraLift } from "../frame.js"
import { pictureFromSearch } from "./picture.js"

const CALLS = ["open", "fit", "seat", "light", "dress", "present"]

test("hd2d is a picture only when the parameter is the string 1", () => {
  assert.equal(pictureFromSearch(""), null)
  assert.equal(pictureFromSearch("?hd2d=true"), null)
  assert.equal(pictureFromSearch("?HD2D=1"), null)
  assert.equal(pictureFromSearch("?name=Ada&hero=warrior"), null)

  const picture = pictureFromSearch("?hd2d=1&name=Ada&hero=warrior")
  assert.equal(picture.fov, 15)
  assert.ok(picture.ready instanceof Promise)
  for (const name of CALLS) assert.equal(typeof picture[name], "function")
})

test("fit and seat hold the palette world on a perspective camera", () => {
  const picture = pictureFromSearch("?hd2d=1&name=Ada&hero=warrior")
  const ready = picture.ready
  const camera = new THREE.PerspectiveCamera()
  const renderer = { setPixelRatio() {}, setSize() {}, domElement: { style: {} } }
  const frame = picture.fit(renderer, camera, 1280, 800, 0)

  assert.equal(frame.bufferWidth, 1280)
  assert.equal(frame.bufferHeight, 800)
  assert.equal(frame.halfH, 168)
  assert.equal(frame.snapHeight, 400)
  assert.equal(pixelStep(frame.halfH, frame.snapHeight), pixelStep(168, 400))
  assert.equal(pixelStep(168, 400), 0.84)
  assert.equal(camera.fov, 15)

  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  picture.seat(camera, { x: 0, z: 0 }, 150, {})
  const look = new THREE.Vector3(0, cameraLift, 0)
  const distance = camera.position.distanceTo(look)
  assert.ok(Math.abs(distance - span) <= 0.01)
  const rise = 0.9 * 150 - cameraLift
  const pitched = new THREE.Vector3(150, rise, 150).normalize()
  assert.ok(camera.position.clone().sub(look).normalize().distanceTo(pitched) <= 0.01)

  // The first call may throw while building the renderer. The second call is the guard.
  try {
    picture.open({})
  } catch (err) {
    assert.notEqual(err.message, "open once")
  }
  assert.throws(() => picture.open({}), { message: "open once" })
  assert.equal(picture.ready, ready)
  for (const name of ["light", "dress", "present"]) {
    assert.throws(() => picture[name](), /not implemented/)
  }
})
