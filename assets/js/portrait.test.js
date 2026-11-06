import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { heroParts } from "./heroes.js"
import { spriteHeight } from "./pictures.js"
import { PORTRAIT_FOV, PORTRAIT_STAND, heroMotion, mixPose, portraitFraction, portraitPose, portraitScale } from "./portrait.js"

function projectHero(cssW, cssH, kind) {
  const pose = portraitPose({ x: PORTRAIT_STAND.x, z: PORTRAIT_STAND.z }, cssW, cssH)
  const camera = new THREE.PerspectiveCamera(PORTRAIT_FOV, cssW / cssH, 1, 4000)
  camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  camera.lookAt(pose.look.x, pose.look.y, pose.look.z)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  const bounds = heroParts(kind).bounds
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  const center = new THREE.Vector3(PORTRAIT_STAND.x, bounds.h / 2, PORTRAIT_STAND.z)
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ].map(([uy, rx]) =>
    center
      .clone()
      .addScaledVector(up, (uy * bounds.h) / 2)
      .addScaledVector(right, (rx * bounds.w) / 2)
      .project(camera)
  )
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const corner of corners) {
    const x = (corner.x * 0.5 + 0.5) * cssW
    const y = (-corner.y * 0.5 + 0.5) * cssH
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { pose, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } }
}

test("the portrait scale is an integer and the hero fills the frame", () => {
  assert.equal(portraitScale(800), 2)
  assert.equal(portraitFraction(800) * 800, 320)
  assert.equal(portraitScale(390), 1)
  assert.ok(Math.abs(portraitFraction(390) * 390 - 160) < 0.01)
  for (const kind of ["warrior", "mage", "scout", "farmer", "engineer"]) {
    for (const size of [
      { w: 1280, h: 800, left: false },
      { w: 844, h: 390, left: true }
    ]) {
      const { box } = projectHero(size.w, size.h, kind)
      const fraction = box.h / size.h
      assert.ok(fraction >= 0.35 && fraction <= 0.45, `${kind} ${size.w}x${size.h} ${fraction}`)
      assert.ok(box.x >= -1 && box.y >= -1, `${kind} origin`)
      assert.ok(box.x + box.w <= size.w + 1 && box.y + box.h <= size.h + 1, `${kind} edge`)
      const center = (box.x + box.w / 2) / size.w
      if (size.left) assert.ok(center < 0.42, `${kind} phone ${center}`)
      else assert.ok(Math.abs(center - 0.5) < 0.12, `${kind} desk ${center}`)
    }
  }
  assert.equal(heroParts("warrior").bounds.h, spriteHeight)
})

test("a class change steps in and the glide meets the gameplay camera", () => {
  const start = heroMotion(1000, 1000)
  assert.ok(start.opacity < 0.2)
  assert.ok(start.slide > 20)
  const done = heroMotion(1000, 2000)
  assert.equal(done.opacity, 1)
  assert.equal(done.slide, 0)
  const from = portraitPose({ x: 120, z: 0 }, 1280, 800)
  const to = { position: { x: 400, y: 500, z: 400 }, look: { x: 80, y: 32, z: 0 } }
  const mid = mixPose(from, to, 0.5)
  assert.ok(mid.position.y > from.position.y && mid.position.y < to.position.y)
  const end = mixPose(from, to, 1)
  assert.equal(end.position.x, to.position.x)
  assert.equal(end.look.y, to.look.y)
})
