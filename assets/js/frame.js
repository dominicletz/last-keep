import { viewScale } from "./town.js"

// CSS pixels per internal texel. Two keeps the nearest-neighbor chunk and
// lifts a hero at rank 4 over the 56px floor. Three left the engineer near 22.
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

// Follow most of the way out. 0.22 left a hero on the spawn ring standing on
// a bat outside the frame. Following all the way hides a goblin on the far
// side of the keep from a hero who is still on the join ring.
export const cameraFollow = 0.72

// The third join-ring seat stands behind the host. A look point on the ground
// leaves that hero above the frame. 32 puts the tallest mesh, the mage, inside
// the picture. A lower look was only quieter on one grass corner. That corner
// is not the picture, and the camera stays at this height.
export const cameraLift = 32

// A headless page stays "visible", so a draw inside the socket handler never
// yields and the test's wait sits until the browser is closed. Recent input
// draws with the tick. An idle page coasts.
export const activeDrawMs = 50
export const idleDrawMs = 250
export const inputWindowMs = 1500
// A paint that runs longer than this fills the frame, so the next one would
// start immediately and the blend poll would never see the 45ms window.
export const slowPaintMs = 40
export const slowPaintGapMs = 70

export function paintGap(submitMs) {
  return Number(submitMs) > slowPaintMs ? slowPaintGapMs : 0
}

export function drawDue(now, lastRender, lastInput) {
  const gap = now - lastInput < inputWindowMs ? activeDrawMs : idleDrawMs
  return now - lastRender >= gap
}

export function cameraFocus(x, y) {
  const hx = Number(x) || 0
  const hy = Number(y) || 0
  return { x: hx * cameraFollow, z: hy * cameraFollow }
}
