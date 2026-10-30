import * as THREE from "three"
import { cameraLift, frameFor } from "../frame.js"

const fov = 15

function notImplemented() {
  throw new Error("not implemented")
}

function bottomRay(camera) {
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const half = THREE.MathUtils.degToRad(camera.fov) / 2
  return forward.multiplyScalar(Math.cos(half)).addScaledVector(up, -Math.sin(half))
}

function createHdPicture() {
  const ready = new Promise(() => {})
  let opened = false
  let span = 0
  let live = false
  return {
    fov,
    ready,
    open(stage) {
      if (opened) throw new Error("open once")
      // A failed constructor still spends the one open.
      opened = true
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false })
      renderer.setPixelRatio(1)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      const camera = new THREE.PerspectiveCamera(fov, 1, 1, 4000)
      camera.up.set(0, 1, 0)
      return { renderer, camera }
    },
    fit(renderer, camera, cssW, cssH, rank) {
      const world = frameFor(cssW, cssH, rank)
      const bufferWidth = Math.max(160, Math.round(cssW))
      const bufferHeight = Math.max(160, Math.round(cssH))
      renderer.setPixelRatio(1)
      renderer.setSize(bufferWidth, bufferHeight, false)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      camera.fov = fov
      camera.aspect = bufferWidth / bufferHeight
      span = world.halfH / Math.tan(THREE.MathUtils.degToRad(fov) / 2)
      camera.near = span * 0.15
      camera.far = span * 2.5
      camera.updateProjectionMatrix()
      return {
        bufferWidth,
        bufferHeight,
        snapHeight: world.bufferHeight,
        aspect: bufferWidth / bufferHeight,
        halfW: world.halfW,
        halfH: world.halfH,
        left: world.left,
        right: world.right,
        top: world.top,
        bottom: world.bottom
      }
    },
    seat(camera, focus, dist, snap) {
      if (!snap || !snap.hd2dStill) live = true
      const rise = 0.9 * dist - cameraLift
      const dir = new THREE.Vector3(dist, rise, dist).normalize()
      const look = new THREE.Vector3(focus.x, cameraLift, focus.z)
      camera.position.copy(look).addScaledVector(dir, span)
      camera.lookAt(look)
      camera.updateMatrixWorld()
      const bottom = bottomRay(camera)
      const groundDistance = bottom.y < 0 ? -camera.position.y / bottom.y : Infinity
      if (groundDistance < camera.near * 2) {
        camera.near = Math.max(1, groundDistance * 0.5)
        camera.updateProjectionMatrix()
      }
    },
    light: notImplemented,
    dress: notImplemented,
    present: notImplemented
  }
}

export function pictureFromSearch(search) {
  const raw = search && search.startsWith("?") ? search : `?${search || ""}`
  if (new URLSearchParams(raw).get("hd2d") !== "1") return null
  return createHdPicture()
}
