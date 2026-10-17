import assert from "node:assert/strict"
import test from "node:test"
import { cameraDistance, dirtRadius, viewScale, zoomFor } from "./town.js"

test("each keep rank pulls the camera back and widens the yard", () => {
  assert.equal(cameraDistance(0), 150)
  assert.equal(dirtRadius(0), 150)
  assert.equal(viewScale(0), 1)
  assert.ok(cameraDistance(1) > cameraDistance(0))
  assert.ok(dirtRadius(2) > dirtRadius(1))
  assert.ok(viewScale(3) > viewScale(2))
  assert.equal(cameraDistance(4), cameraDistance(9))
  const zoom = zoomFor({ town: 2, camera: 222, dirt: 230, view_scale: 1.24 })
  assert.equal(zoom.camera, 222)
  assert.equal(zoom.dirt, 230)
  assert.equal(zoom.scale, 1.24)
})
