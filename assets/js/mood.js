import { hueOf, lumaOf } from "./scene.js"

// Floors sit in the gap between theme.jpg and the 2026-10-18 live frames
// (assets/js/fixtures/live-*.jpg). A flat tint passes a single patch and fails
// here. Do not lower a floor. Day may be brighter than the sheet. It may not
// be a saturated lime field.
export const moodFloor = {
  contrast: 9,
  lime: 0.08,
  cool: 0.25,
  warm: 0.03
}

export function moodOf(rgba, width, height) {
  const count = width * height
  let lime = 0
  let warm = 0
  let cool = 0
  const step = 16
  let blocks = 0
  let contrast = 0
  for (let y = 0; y <= height - step; y += step) {
    for (let x = 0; x <= width - step; x += step) {
      let sum = 0
      let sumSq = 0
      const n = step * step
      for (let yy = y; yy < y + step; yy++) {
        for (let xx = x; xx < x + step; xx++) {
          const offset = (yy * width + xx) * 4
          const luma = lumaOf(rgba[offset], rgba[offset + 1], rgba[offset + 2])
          sum += luma
          sumSq += luma * luma
        }
      }
      const mean = sum / n
      contrast += Math.sqrt(Math.max(0, sumSq / n - mean * mean))
      blocks += 1
    }
  }
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const luma = lumaOf(r, g, b)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const span = max - min
    if (span < 8 || max === 0) continue
    const sat = span / max
    const hue = hueOf(r, g, b)
    if (hue >= 78 && hue <= 130 && sat > 0.5 && luma > 80 && g > r + 15) lime += 1
    if (hue >= 10 && hue <= 50 && sat > 0.35 && luma > 90) warm += 1
    if (hue >= 250 && hue <= 330 && sat > 0.12 && luma > 30 && luma < 150) cool += 1
  }
  return {
    contrast: blocks ? contrast / blocks : 0,
    lime: lime / count,
    warm: warm / count,
    cool: cool / count
  }
}

export function moodProblems(mood, phase) {
  const problems = []
  if (mood.contrast < moodFloor.contrast) {
    problems.push(`contrast ${mood.contrast.toFixed(2)} is a flat field`)
  }
  if ((phase === "day" || phase === "concept") && mood.lime > moodFloor.lime) {
    problems.push(`lime share ${mood.lime.toFixed(3)} is a golf-course field`)
  }
  if (phase === "dusk" || phase === "concept") {
    if (mood.cool > moodFloor.cool) problems.push(`cool wash ${mood.cool.toFixed(3)} tints the frame`)
    if (mood.warm < moodFloor.warm) problems.push(`warm tail ${mood.warm.toFixed(3)} has no highlights`)
  }
  return problems
}
