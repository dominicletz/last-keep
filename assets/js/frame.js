import { viewScale } from "./town.js"

// CSS pixels per internal texel. Two keeps the nearest-neighbor chunk and
// lifts a hero at rank 4 over the 24px floor. Three left the engineer near 22.
export const pixelSize = 2

// The buffer uses the window's aspect so a CSS fill does not stretch pixels.
// The frustum uses that same aspect. A narrow window grows the vertical view
// until the yard still fits across the width, so the keep stays in frame.
// A higher town rank scales that frustum so the camera pulls back.
export function frameFor(cssWidth, cssHeight, rank = 0) {
  const cssW = Math.max(1, Number(cssWidth) || 1)
  const cssH = Math.max(1, Number(cssHeight) || 1)
  const pixel = pixelSize
  const bufferWidth = Math.max(160, Math.round(cssW / pixel))
  const bufferHeight = Math.max(160, Math.round(cssH / pixel))
  const aspect = bufferWidth / bufferHeight
  const scale = viewScale(rank)
  const minHalfW = 180 * scale
  let halfH = 168 * scale
  let halfW = halfH * aspect
  if (halfW < minHalfW) {
    halfW = minHalfW
    halfH = halfW / aspect
  }
  return {
    bufferWidth,
    bufferHeight,
    aspect,
    halfW,
    halfH,
    left: -halfW,
    right: halfW,
    top: halfH,
    bottom: -halfH
  }
}
