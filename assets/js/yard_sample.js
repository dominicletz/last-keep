import * as THREE from "three"
import { GROUND_SPAN, GROUND_TEX } from "./ground.js"

// The ground color under a painted pixel, on the same ray the gameplay camera uses.
export function groundUnderMask(image, camera, frame, tex) {
  const ground = new Uint8Array(image.width * image.height * 3)
  for (let i = 0; i < image.mask.length; i++) {
    if (!image.mask[i]) continue
    const px = i % image.width
    const py = (i / image.width) | 0
    const ndcX = ((px + 0.5) / frame.bufferWidth) * 2 - 1
    const ndcY = -(((py + 0.5) / frame.bufferHeight) * 2 - 1)
    const origin = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera)
    const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera)
    const dir = far.sub(origin)
    const t = -origin.y / dir.y
    const worldX = origin.x + dir.x * t
    const worldZ = origin.z + dir.z * t
    const u = Math.floor((worldX / GROUND_SPAN + 0.5) * GROUND_TEX)
    const v = Math.floor((-worldZ / GROUND_SPAN + 0.5) * GROUND_TEX)
    const o = (v * GROUND_TEX + u) * 4
    ground[i * 3] = tex[o]
    ground[i * 3 + 1] = tex[o + 1]
    ground[i * 3 + 2] = tex[o + 2]
  }
  return ground
}
