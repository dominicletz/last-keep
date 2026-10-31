// HD-2D camera, written out so a test can project a hero without booting three.
//
// picture.js sets LOOK.fov to 15. frameFor(1280, 800) at rank 0 keeps halfH
// at 168, because pixelSize is 2 and the snap height is 400. picture.fit
// places the camera at
//   span = halfH / tan(fov / 2)
// from the look point. picture.seat steps from cameraDistance(0), which is
// 150, along normalize(dist, 0.9 * dist - cameraLift, dist) with cameraLift
// 32. The elevation of that direction is atan(0.9 / sqrt(2)).
//
// The view plane at distance span is 2 * halfH world units tall and fills
// the drawing buffer. figurePixels projects the mesh AABB through the same
// perspective camera and reports (maxY - minY) * 0.5 * bufferHeight.
// projectBox repeats that projection for an axis-aligned box: camera lookAt,
// then the perspective divide. A world-vertical card of height H is the box
// from its feet to H, and the on-screen bound is that projection.

const FOV_DEG = 15
const HALF_H = 168
const CAMERA_DISTANCE = 150
const CAMERA_LIFT = 32
const CAMERA_FOLLOW = 0.72
const HOST_RING = { x: 120, z: 0 }

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

function norm(a) {
  const length = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}

function hd2dCamera() {
  const fov = (FOV_DEG * Math.PI) / 180
  const span = HALF_H / Math.tan(fov / 2)
  const dist = CAMERA_DISTANCE
  const rise = 0.9 * dist - CAMERA_LIFT
  const dir = norm({ x: dist, y: rise, z: dist })
  const look = {
    x: HOST_RING.x * CAMERA_FOLLOW,
    y: CAMERA_LIFT,
    z: HOST_RING.z * CAMERA_FOLLOW
  }
  const eye = {
    x: look.x + dir.x * span,
    y: look.y + dir.y * span,
    z: look.z + dir.z * span
  }
  return { eye, look, fov, span, halfH: HALF_H }
}

function projectY(camera, point) {
  const zaxis = norm(sub(camera.eye, camera.look))
  const xaxis = norm(cross({ x: 0, y: 1, z: 0 }, zaxis))
  const yaxis = cross(zaxis, xaxis)
  const relative = sub(point, camera.eye)
  const viewY = dot(relative, yaxis)
  const viewZ = dot(relative, zaxis)
  const focal = 1 / Math.tan(camera.fov / 2)
  return (focal * viewY) / -viewZ
}

// Screen pixels of an axis-aligned box. bufferHeight is the drawing buffer,
// the window, not the 400px snap.
function projectBox(box, bufferHeight, bufferWidth = bufferHeight * (1280 / 800)) {
  const camera = hd2dCamera()
  let minY = Infinity
  let maxY = -Infinity
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const ndc = projectY(camera, { x, y, z })
        if (ndc < minY) minY = ndc
        if (ndc > maxY) maxY = ndc
      }
    }
  }
  if (!(bufferWidth > 0)) throw new Error("buffer")
  return (maxY - minY) * 0.5 * bufferHeight
}

// A hero card stands on y = 0 with its width in x and no depth. Yaw spins
// that plane about Y so the bound covers the card facing the camera.
function cardBox(x, z, height, width, yaw = 0) {
  const hx = Math.cos(yaw) * (width / 2)
  const hz = Math.sin(yaw) * (width / 2)
  const corners = [
    { x: x + hx, y: 0, z: z + hz },
    { x: x - hx, y: 0, z: z - hz },
    { x: x + hx, y: height, z: z + hz },
    { x: x - hx, y: height, z: z - hz }
  ]
  const box = {
    min: { x: Infinity, y: 0, z: Infinity },
    max: { x: -Infinity, y: height, z: -Infinity }
  }
  for (const corner of corners) {
    box.min.x = Math.min(box.min.x, corner.x)
    box.max.x = Math.max(box.max.x, corner.x)
    box.min.z = Math.min(box.min.z, corner.z)
    box.max.z = Math.max(box.max.z, corner.z)
  }
  return box
}

// faceCamera keeps the card upright and yaws it so the plane normal points
// at the eye. PlaneGeometry's width is local +X. rotation.y = atan2(dx, dz)
// sends that axis to (cos θ, -sin θ), which is cardBox's yaw of -θ. The
// edge-on yaw is a quarter turn from that. The two are the short and tall
// projections of one card through this camera.
function cardSpan(x, z, height, width, bufferHeight) {
  const camera = hd2dCamera()
  const face = -Math.atan2(camera.eye.x - x, camera.eye.z - z)
  let min = Infinity
  let max = 0
  for (const yaw of [face, face + Math.PI / 2]) {
    const pixels = projectBox(cardBox(x, z, height, width, yaw), bufferHeight)
    min = Math.min(min, pixels)
    max = Math.max(max, pixels)
  }
  return { min, max }
}

module.exports = {
  FOV_DEG,
  HALF_H,
  CAMERA_DISTANCE,
  CAMERA_LIFT,
  HOST_RING,
  hd2dCamera,
  projectBox,
  cardSpan
}
