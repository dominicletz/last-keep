export function lerp(from, to, t) {
  const blend = Math.min(1, Math.max(0, t))
  return from + (to - from) * blend
}

export function poseAt(track, now, duration = 45) {
  if (!track) return { x: 0, z: 0 }
  const t = (now - track.at) / duration
  return {
    x: lerp(track.fromX, track.toX, t),
    z: lerp(track.fromZ, track.toZ, t)
  }
}

export function nextTrack(prev, x, z, now) {
  if (prev && prev.toX === x && prev.toZ === z) return prev
  return {
    fromX: prev ? prev.toX : x,
    fromZ: prev ? prev.toZ : z,
    toX: x,
    toZ: z,
    at: now
  }
}
