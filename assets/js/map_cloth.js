// Layout for the map cloth on the yard table at (0, 160).
// Draws one distinct spaced mark per discovered chunk, colored by state
// (keep center, active portal, claimed land, or discovered wilderness).

export const CLOTH_WIDTH = 56
export const CLOTH_HEIGHT = 38

export const MARK_COLOR = {
  keep: 0x7ea35a,
  portal: 0xd9483b,
  claimed: 0xf0c14a,
  discovered: 0xe6d3a1
}

function validChunk(chunk) {
  if (!chunk) return false
  const cx = Number(chunk.cx)
  const cy = Number(chunk.cy)
  return Number.isInteger(cx) && Number.isInteger(cy) && cx >= -14 && cx <= 14 && cy >= -14 && cy <= 14
}

function chunkKey(cx, cy) {
  return `${cx},${cy}`
}

export function layoutMapMarks(map, width = CLOTH_WIDTH, height = CLOTH_HEIGHT) {
  const chunks = (map && Array.isArray(map.chunks) ? map.chunks : []).filter(validChunk)
  if (chunks.length === 0) return { marks: [], count: 0, sig: "" }

  const claimed = new Set(
    (map && Array.isArray(map.claimed) ? map.claimed : []).filter(validChunk).map((c) => chunkKey(c.cx, c.cy))
  )
  const portals = new Set(
    (map && Array.isArray(map.portals) ? map.portals : []).filter(validChunk).map((c) => chunkKey(c.cx, c.cy))
  )

  let minX = -3
  let maxX = 2
  let minY = -3
  let maxY = 2
  for (const chunk of chunks) {
    if (chunk.cx < minX) minX = chunk.cx
    if (chunk.cx > maxX) maxX = chunk.cx
    if (chunk.cy < minY) minY = chunk.cy
    if (chunk.cy > maxY) maxY = chunk.cy
  }

  const cols = maxX - minX + 1
  const rows = maxY - minY + 1
  const padX = width * 0.08
  const padY = height * 0.1
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const cellW = innerW / cols
  const cellH = innerH / rows
  const sx = cellW * 0.78
  const sy = cellH * 0.78

  const marks = chunks.map((chunk) => {
    const key = chunkKey(chunk.cx, chunk.cy)
    const isKeep = chunk.cx >= -1 && chunk.cx <= 0 && chunk.cy >= -1 && chunk.cy <= 0
    let color = MARK_COLOR.discovered
    if (portals.has(key)) color = MARK_COLOR.portal
    else if (isKeep) color = MARK_COLOR.keep
    else if (claimed.has(key)) color = MARK_COLOR.claimed

    const ix = chunk.cx - minX
    const iy = chunk.cy - minY
    const x = -innerW / 2 + (ix + 0.5) * cellW
    const y = innerH / 2 - (iy + 0.5) * cellH
    return { cx: chunk.cx, cy: chunk.cy, x, y, sx, sy, color }
  })

  const sig = [
    chunks.map((c) => chunkKey(c.cx, c.cy)).join("|"),
    [...claimed].sort().join("|"),
    [...portals].sort().join("|")
  ].join("::")

  return { marks, count: marks.length, sig }
}
