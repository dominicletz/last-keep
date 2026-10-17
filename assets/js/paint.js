// A yard pixel that belongs to a drawn body.
// Red is the old goblin hide. The dark triple is the outline rim.
// Lit grass reads near 99,106,30 and must not count.
export function bodyPixel(r, g, b) {
  if (r > 150 && r > g + 40 && r > b + 20) return true
  return r < 48 && g < 48 && b < 40
}
