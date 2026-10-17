import fs from "node:fs"
import jpeg from "jpeg-js"

// Palette hexes are the jpeg-js lower median of the cited patch.
// Sort each channel and take index (length - 1) >> 1. Do not use another decoder.

export function loadSheet(file) {
  const decoded = jpeg.decode(fs.readFileSync(file), { useTArray: true, formatAsRGBA: true })
  return { width: decoded.width, height: decoded.height, data: decoded.data }
}

export function medianHex(sheet, region) {
  const channels = [[], [], []]
  for (let y = 0; y < region.h; y++) {
    for (let x = 0; x < region.w; x++) {
      const offset = ((region.y + y) * sheet.width + (region.x + x)) * 4
      channels[0].push(sheet.data[offset])
      channels[1].push(sheet.data[offset + 1])
      channels[2].push(sheet.data[offset + 2])
    }
  }
  return channels
    .map((values) => {
      values.sort((a, b) => a - b)
      return values[(values.length - 1) >> 1]
    })
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

export function citationProblems(cited, sheets) {
  const problems = []
  if (!cited.length) problems.push("STYLE.md palette has no cited tokens")
  const names = new Set()
  for (const token of cited) {
    if (names.has(token.name)) problems.push(`palette token ${token.name} is cited twice`)
    names.add(token.name)
    const sheet = sheets[token.sheet]
    if (!sheet) {
      problems.push(`palette token ${token.name} cites ${token.sheet}, which is not loaded`)
      continue
    }
    const { x, y, w, h } = token.region
    if (!(w > 0) || !(h > 0) || x < 0 || y < 0 || x + w > sheet.width || y + h > sheet.height) {
      problems.push(`palette token ${token.name} region is outside ${token.sheet}`)
      continue
    }
    const median = medianHex(sheet, token.region)
    if (median !== token.hex) {
      problems.push(`palette token ${token.name} #${token.hex} does not match ${token.sheet} median #${median}`)
    }
  }
  return problems
}
