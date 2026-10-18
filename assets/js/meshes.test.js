import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { giveBurst, releaseGeometries, shotSphere, takeBurst } from "./meshes.js"

test("a dropped mesh disposes a shared geometry once and leaves a pooled sphere", () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const mesh = new THREE.Mesh(geometry)
  mesh.add(new THREE.Mesh(geometry))
  let disposed = 0
  geometry.dispose = () => {
    disposed += 1
  }
  releaseGeometries(mesh)
  assert.equal(disposed, 1)

  const bolt = shotSphere(6)
  const again = shotSphere(6)
  assert.equal(again, bolt)
  assert.notEqual(shotSphere(11), bolt)
  let pooled = 0
  bolt.dispose = () => {
    pooled += 1
  }
  releaseGeometries(new THREE.Mesh(bolt))
  assert.equal(pooled, 0)
})

test("a dropped hero leaves the shared sprite plane", () => {
  const card = new THREE.Sprite()
  const other = new THREE.Sprite()
  assert.equal(card.geometry, other.geometry)
  let disposed = 0
  card.geometry.dispose = () => {
    disposed += 1
  }
  const bar = new THREE.BoxGeometry(1, 1, 1)
  let bars = 0
  bar.dispose = () => {
    bars += 1
  }
  card.add(new THREE.Mesh(bar))
  releaseGeometries(card)
  assert.equal(disposed, 0)
  assert.equal(bars, 1)
  assert.equal(other.geometry, card.geometry)
})

test("a burst sphere is reused and takes the next color", () => {
  const first = takeBurst(0xff0000)
  giveBurst(first)
  const second = takeBurst(0x00ff00)
  assert.equal(second, first)
  assert.equal(second.material.color.getHex(), 0x00ff00)
  assert.equal(second.material.opacity, 0.9)
  assert.equal(second.visible, true)
})
