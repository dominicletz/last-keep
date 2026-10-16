// The buffer uses the window's aspect so a CSS fill does not stretch pixels.
// The frustum uses that same aspect. A narrow window grows the vertical view
// until the yard still fits across the width, so the keep stays in frame.
export function frameFor(cssWidth, cssHeight) {
  const cssW = Math.max(1, Number(cssWidth) || 1)
  const cssH = Math.max(1, Number(cssHeight) || 1)
  const pixel = 3
  const bufferWidth = Math.max(160, Math.round(cssW / pixel))
  const bufferHeight = Math.max(160, Math.round(cssH / pixel))
  const aspect = bufferWidth / bufferHeight
  const minHalfW = 180
  let halfH = 168
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
