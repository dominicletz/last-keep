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

export function sceneRegions(markdown) {
  const regions = {}
  for (const line of markdown.split("\n")) {
    const row = line.match(/^\| (ground|sky) \| (theme\.jpg) \| (\d+),(\d+),(\d+),(\d+) \|/)
    if (!row) continue
    regions[row[1]] = {
      sheet: row[2],
      region: { x: Number(row[3]), y: Number(row[4]), w: Number(row[5]), h: Number(row[6]) }
    }
  }
  return regions
}

function rgbOf(hex) {
  const value = typeof hex === "string" ? Number.parseInt(hex, 16) : hex
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function colorDist(a, b) {
  const left = Array.isArray(a) ? a : rgbOf(a)
  const right = Array.isArray(b) ? b : rgbOf(b)
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function chroma(rgb) {
  const sum = rgb[0] + rgb[1] + rgb[2]
  if (sum === 0) return [0, 0, 0]
  return [rgb[0] / sum, rgb[1] / sum, rgb[2] / sum]
}

function chromaDist(a, b) {
  const left = chroma(a)
  const right = chroma(b)
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

// Ground must be the moss, not the thatch roof. Gallery skies must be shades of the dusk sky.
export function sceneColorProblems(markdown, sheet, cited, rigs, colors) {
  const problems = []
  const regions = sceneRegions(markdown)
  if (!regions.ground || !regions.sky) {
    problems.push("STYLE.md does not cite a ground region and a sky region")
    return problems
  }
  const groundMedian = medianHex(sheet, regions.ground.region)
  const skyMedian = medianHex(sheet, regions.sky.region)
  const grass = cited.find((token) => token.name === "grass")
  const roof = cited.find((token) => token.name === "thatch")
  if (!grass || !roof) {
    problems.push("STYLE.md is missing the grass or thatch token")
    return problems
  }
  const grassGround = colorDist(grass.hex, groundMedian)
  const grassRoof = colorDist(grass.hex, roof.hex)
  if (grassGround > 18) {
    problems.push(`grass #${grass.hex} is ${grassGround.toFixed(1)} away from the concept ground #${groundMedian}`)
  }
  if (!(grassRoof > grassGround)) {
    problems.push(`grass #${grass.hex} is closer to the thatch roof #${roof.hex} than to the concept ground #${groundMedian}`)
  }
  const groundHex = rgbOf(colors.ground).map((channel) => channel.toString(16).padStart(2, "0")).join("")
  const skyHex = rgbOf(colors.sky).map((channel) => channel.toString(16).padStart(2, "0")).join("")
  if (groundHex !== grass.hex) problems.push(`yard ground #${groundHex} is not the grass token #${grass.hex}`)
  if (skyHex !== skyMedian) problems.push(`sky color #${skyHex} is not the concept sky median #${skyMedian}`)
  const path = cited.find((token) => token.name === "path")
  const stone = cited.find((token) => token.name === "stone")
  if (!path || !stone) {
    problems.push("STYLE.md is missing the path or stone token")
  } else if (colors.plaza == null || colors.ring == null) {
    problems.push("yard plaza color is missing")
  } else {
    const plazaHex = rgbOf(colors.plaza).map((channel) => channel.toString(16).padStart(2, "0")).join("")
    const ringHex = rgbOf(colors.ring).map((channel) => channel.toString(16).padStart(2, "0")).join("")
    if (plazaHex !== grass.hex) problems.push(`yard plaza #${plazaHex} is not the grass token #${grass.hex}`)
    if (!(colorDist(plazaHex, path.hex) > colorDist(plazaHex, grass.hex))) {
      problems.push(`yard plaza #${plazaHex} is closer to the path than to the grass`)
    }
    if (ringHex !== stone.hex) problems.push(`yard ring #${ringHex} is not the stone token #${stone.hex}`)
  }
  const skyRgb = rgbOf(skyMedian)
  const roofRgb = rgbOf(roof.hex)
  for (const name of ["day", "dusk", "night"]) {
    const bg = rigs[name] && rigs[name].bg
    if (!bg) {
      problems.push(`${name} gallery background is missing`)
      continue
    }
    const towardSky = chromaDist(bg, skyRgb)
    const towardRoof = chromaDist(bg, roofRgb)
    if (towardSky > 0.04) {
      problems.push(`${name} gallery background mix is ${towardSky.toFixed(3)} away from the concept sky`)
    }
    if (!(towardRoof > towardSky)) {
      problems.push(`${name} gallery background is closer to the roof than to the sky`)
    }
  }
  if (rigs.day && colorDist(rigs.day.bg, skyRgb) > 1) {
    problems.push("day gallery background is not the concept sky")
  }
  return problems
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
