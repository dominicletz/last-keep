// Boom, death, and slam share one sheet. A row is an event. A column is a
// frame. The sprite is not scaled up: the drawing grows inside the cell.

export const BURST_MS = 520
export const BURST_FRAMES = 6
export const BURST_CELL = 32
export const BURSTS = ["boom", "death", "slam"]
export const BURST_SHEET = "/images/hd2d/burst-sheet.png"

export function burstRow(type) {
  const index = BURSTS.indexOf(type)
  return index < 0 ? null : index
}

// 0 at the start, the last frame as the 520 ms runs out.
export function burstFrame(elapsed, frames = BURST_FRAMES, span = BURST_MS) {
  if (!(elapsed > 0)) return 0
  const index = Math.floor((elapsed / span) * frames)
  return Math.min(frames - 1, Math.max(0, index))
}
