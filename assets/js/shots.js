// Pre-rotated arrow frames and the fireball flicker. The sprite is never turned
// in the engine: a turn off the texel grid would smear the pixels.

export const ARROW_FRAMES = 8
export const FIRE_FRAMES = 4
export const FIRE_STEP = 90

export const SHOTS = {
  arrow: { sheet: "arrow", frames: 8, cell: 24, figure: 18, px: 18, bloom: false },
  bolt: { sheet: "arrow", frames: 8, cell: 24, figure: 18, px: 18, bloom: false },
  volley: { sheet: "arrow", frames: 8, cell: 24, figure: 18, px: 18, bloom: false },
  fireball: { sheet: "fire", frames: 4, cell: 16, figure: 14, px: 14, bloom: true },
  meteor: { sheet: "fire", frames: 4, cell: 16, figure: 14, px: 18, bloom: true },
  frost: { sheet: "frost", frames: 1, cell: 16, figure: 12, px: 12, bloom: false }
}

export const SHOT_URL = {
  arrow: "/images/hd2d/arrow-sheet.png",
  fire: "/images/hd2d/fire-sheet.png",
  frost: "/images/hd2d/frost.png"
}

export function shotArt(kind) {
  return SHOTS[kind] || SHOTS.arrow
}

// Screen y is up. 0° is to the right, which is frame 0 of the arrow sheet.
// The eight frames step counter-clockwise by 45°.
export function arrowFrame(dx, dy) {
  if (!dx && !dy) return 0
  const index = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  return ((index % ARROW_FRAMES) + ARROW_FRAMES) % ARROW_FRAMES
}

export function fireFrame(now, frames = FIRE_FRAMES, step = FIRE_STEP) {
  const tick = Math.floor(Math.max(0, now) / step)
  return ((tick % frames) + frames) % frames
}

export function shotScale(art, texel) {
  return art.cell * texel * (art.px / art.figure)
}
