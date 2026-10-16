export function lerp(from, to, t) {
  const blend = Math.min(1, Math.max(0, t))
  return from + (to - from) * blend
}
