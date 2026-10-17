export function townLevel(rank) {
  const level = Number(rank)
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.min(4, Math.floor(level)))
}

export function cameraDistance(rank) {
  return 150 + townLevel(rank) * 36
}

export function dirtRadius(rank) {
  return 150 + townLevel(rank) * 40
}

export function viewScale(rank) {
  return 1 + townLevel(rank) * 0.12
}

export function zoomFor(snap) {
  const rank = townLevel(snap?.town)
  return {
    camera: snap?.camera || cameraDistance(rank),
    dirt: snap?.dirt || dirtRadius(rank),
    scale: snap?.view_scale || viewScale(rank)
  }
}
