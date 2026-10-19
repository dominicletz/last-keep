// Bone is the monster-sheet token. A scale above 1 is the rim at the gameplay
// camera. The bat and the rider already wore that rim. The others were a
// one-pixel dark that never left the body.
export function monsterRim(kind) {
  if (kind === "bat" || kind === "boss") return { color: 0x908b8a, scale: 1.2 }
  return { color: 0x908b8a, scale: 1.15 }
}

// The live sprite shares the body's foot anchor, so a larger scale grows upward.
// The yard raster dilates every direction, including below the feet. Drop the
// rim by half the extra height, and step it away from the camera so it sorts
// with this body instead of behind every other body.
export function rimSeat(height, scale, fromCamera) {
  const drop = (height * Math.max(0, scale - 1)) / 2
  const len = Math.hypot(fromCamera.x, fromCamera.y, fromCamera.z) || 1
  const step = 1
  return {
    x: (fromCamera.x / len) * step,
    y: -drop + (fromCamera.y / len) * step,
    z: (fromCamera.z / len) * step,
    renderOrder: 0
  }
}

export function monsterSpread(id) {
  const n = Math.abs(Math.trunc(Number(id)) || 0)
  const sign = n % 2 === 0 ? 1 : -1
  const mag = 6 + (n % 3)
  const lateral = sign * mag
  return { x: lateral, z: -lateral, bar: (n % 3) * 6 }
}

export function spreadGap(leftId, rightId) {
  const left = monsterSpread(leftId)
  const right = monsterSpread(rightId)
  return Math.hypot(left.x - right.x, left.z - right.z)
}
