export const maxTurn = 0.7
export const blendMs = 50

export function lerp(from, to, t) {
  const blend = Math.min(1, Math.max(0, t))
  return from + (to - from) * blend
}

export function wrapAngle(rad) {
  const turn = Math.PI * 2
  return ((((rad + Math.PI) % turn) + turn) % turn) - Math.PI
}

export function stepYaw(current, target, maxStep = maxTurn) {
  const delta = wrapAngle(target - current)
  const step = Math.max(-maxStep, Math.min(maxStep, delta))
  return { yaw: current + step, step, done: Math.abs(delta) <= maxStep }
}

export function poseAt(track, now, duration = blendMs) {
  if (!track) return { x: 0, z: 0 }
  const t = (now - track.at) / duration
  return {
    x: lerp(track.fromX, track.toX, t),
    z: lerp(track.fromZ, track.toZ, t)
  }
}

const walkStepCap = 13.8

export function nextTrack(prev, x, z, now, duration = blendMs, vx = 0, vz = 0) {
  if (prev && prev.toX === x && prev.toZ === z) return prev
  if (!prev) {
    const dx = Number.isFinite(vx) ? vx : 0
    const dz = Number.isFinite(vz) ? vz : 0
    return {
      fromX: x - dx,
      fromZ: z - dz,
      toX: x,
      toZ: z,
      at: now
    }
  }
  const here = poseAt(prev, now, duration)
  let fromX = here.x
  let fromZ = here.z
  const rawStep = Math.hypot(x - prev.toX, z - prev.toZ)
  const span = Math.hypot(x - fromX, z - fromZ)
  if (rawStep < 14 && span > walkStepCap) {
    const scale = walkStepCap / span
    fromX = x - (x - fromX) * scale
    fromZ = z - (z - fromZ) * scale
  }
  return {
    fromX,
    fromZ,
    toX: x,
    toZ: z,
    at: now
  }
}
