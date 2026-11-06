import { cardSourceHeight, spriteHeight } from "./pictures.js"

export const PORTRAIT_FOV = 48
const PITCH = 0.18
const SIDE = 0.46
const LOOK_Y = 16
const SWAP_SOURCE = cardSourceHeight

export const PORTRAIT_STAND = { x: 108, z: 28 }
export const ARRIVE_MS = 800

export function portraitScale(cssH) {
  const height = Math.max(1, Number(cssH) || 1)
  let best = 1
  let gap = Infinity
  for (let k = 1; k <= 8; k++) {
    const fraction = (k * SWAP_SOURCE) / height
    if (fraction < 0.35 || fraction > 0.45) continue
    const next = Math.abs(fraction - 0.4)
    if (next < gap) {
      best = k
      gap = next
    }
  }
  return best
}

export function portraitFraction(cssH) {
  const height = Math.max(1, Number(cssH) || 1)
  return (portraitScale(height) * SWAP_SOURCE) / height
}

export function portraitDistance(cssH) {
  const half = ((PORTRAIT_FOV * Math.PI) / 180) / 2
  return spriteHeight / (portraitFraction(cssH) * 2 * Math.tan(half))
}

export function portraitFacing(viewYaw) {
  const step = Math.PI / 4
  return 2 * step - viewYaw
}

export function portraitPose(hero, cssW, cssH) {
  const hx = Number(hero && hero.x) || 0
  const hz = Number(hero && hero.z) || 0
  const distance = portraitDistance(cssH)
  const span = Math.hypot(hx, hz) || 1
  const ox = hx / span
  const oz = hz / span
  const sx = -oz
  const sz = ox
  const dirX = ox * Math.cos(SIDE) + sx * Math.sin(SIDE)
  const dirZ = oz * Math.cos(SIDE) + sz * Math.sin(SIDE)
  const width = Math.max(1, Number(cssW) || 1)
  const height = Math.max(1, Number(cssH) || 1)
  const visibleH = spriteHeight / portraitFraction(height)
  const visibleW = visibleH * (width / height)
  const shift = height <= 520 ? visibleW * 0.16 : 0
  const look = { x: hx + dirZ * shift, y: LOOK_Y, z: hz - dirX * shift }
  const cp = Math.cos(PITCH)
  const sp = Math.sin(PITCH)
  const position = {
    x: look.x + dirX * distance * cp,
    y: look.y + distance * sp,
    z: look.z + dirZ * distance * cp
  }
  const viewYaw = Math.atan2(position.x - hx, position.z - hz)
  return {
    position,
    look,
    distance,
    facing: portraitFacing(viewYaw),
    side: { x: sx, z: sz },
    fraction: portraitFraction(height),
    scale: portraitScale(height)
  }
}

export function mixPose(from, to, t) {
  const k = Math.min(1, Math.max(0, t))
  const s = k * k * (3 - 2 * k)
  const mix = (a, b) => a + (b - a) * s
  return {
    position: {
      x: mix(from.position.x, to.position.x),
      y: mix(from.position.y, to.position.y),
      z: mix(from.position.z, to.position.z)
    },
    look: {
      x: mix(from.look.x, to.look.x),
      y: mix(from.look.y, to.look.y),
      z: mix(from.look.z, to.look.z)
    }
  }
}

export function heroMotion(started, now) {
  if (!started) return { slide: 0, opacity: 1, turn: 0 }
  const t = (now - started) / 380
  if (t >= 1) return { slide: 0, opacity: 1, turn: 0 }
  return { slide: (1 - t) * 28, opacity: 0.15 + 0.85 * t, turn: (1 - t) * 1.15 }
}
