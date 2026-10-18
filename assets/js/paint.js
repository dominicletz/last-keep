// A yard pixel that belongs to a drawn body.
// Red is the old goblin hide. The dark triple is the outline rim.
// Lit grass reads near 99,106,30 and must not count.
// Recorded before the scene draw. A fireball that only exists for one tick
// still counts if the heavy draw is waiting for the next frame.
export function absorbShots(kinds, projectiles) {
  const next = Array.isArray(kinds) ? kinds.slice() : []
  for (const shot of projectiles || []) {
    const kind = shot && shot.kind
    if (kind && !next.includes(kind)) next.push(kind)
  }
  return next
}

export function bodyPixel(r, g, b) {
  if (r > 150 && r > g + 40 && r > b + 20) return true
  return r < 48 && g < 48 && b < 40
}
