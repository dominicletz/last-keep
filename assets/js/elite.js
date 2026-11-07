export const ELITE_MARKS = ["plated", "lean", "spiked"]
export const ELITE_MARK_SHEET = "/images/hd2d/elite-marks.png"
// Each mark fits in one cell. The lean chevron's long side is at most 20 px.
export const ELITE_MARK_CELL = { w: 24, h: 24 }

export function eliteLook(row) {
  if (row?.kind === "boss") return "horned"
  if (row?.elite === "armored") return "plated"
  if (row?.elite === "fast") return "lean"
  if (row?.elite === "enraged") return "spiked"
  return "plain"
}

// The cell on the mark sheet, or null when this monster wears no mark.
export function eliteMark(row) {
  const look = eliteLook(row)
  const index = ELITE_MARKS.indexOf(look)
  if (index < 0) return null
  return { look, index }
}
