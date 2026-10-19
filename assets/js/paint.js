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

export function partyPositions(players) {
  return (players || []).map((player) => ({
    id: player.id,
    x: player.x,
    y: player.y,
    host: !!player.host,
    alive: !!player.alive,
    hero: player.hero
  }))
}

// The join reply and every later snapshot list who the room accepted.
// A hidden roster has no innerText, so the seat list is the confirmation.
export function seatList(players) {
  return (players || []).map((player) => ({
    id: player.id,
    name: player.name,
    hero: player.hero,
    connected: player.connected === true
  }))
}

// A backed-up channel can deliver the swing only as saw_swing, after the
// 8-tick cooldown has already reached 0. The latch has to outlive that pulse.
export function swingSeen(snap) {
  if (!snap) return false
  if (snap.saw_swing) return true
  return (snap.events || []).some((ev) => ev && ev.type === "swing")
}

export function nextAttackPeak(previous, cooldown, sawSwing) {
  const seen = Math.max(Number(previous) || 0, Number(cooldown) || 0)
  return sawSwing ? Math.max(seen, 1) : seen
}

export function bodyPixel(r, g, b) {
  if (r > 150 && r > g + 40 && r > b + 20) return true
  return r < 48 && g < 48 && b < 40
}
