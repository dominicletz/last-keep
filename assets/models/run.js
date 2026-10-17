import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  conceptProblems,
  conceptSheets,
  coverageProblems,
  fitProblems,
  fitSlack,
  iouLimit,
  models,
  keepStoneProblems,
  paletteProblems,
  radiusProblems,
  rulesFrom,
  styleProblems,
  styleTables,
  uncitedPaletteProblems
} from "./registry.js"
import {
  blitCrop,
  decodePng,
  encodePng,
  galleryRigs,
  lightNames,
  closeupFigure,
  maskArea,
  maskBounds,
  maskIou,
  meanLuma,
  missingConcept,
  nightContrast,
  pixelDiff,
  renderCloseup,
  renderParts,
  stackHorizontal
} from "./raster.js"
import { groundColor, pathColor, plazaColor, ringColor, skyColor } from "../js/scene.js"
import { detailFloor, detailProblems } from "./voxels.js"
import { citationProblems, loadSheet, sceneColorProblems } from "./sheets.js"

const root = fileURLToPath(new URL("../../", import.meta.url))

export function repoRoot() {
  return root
}

export function checkModels({ writeGolden = false } = {}) {
  const problems = []
  const listed = models()
  const rulesSource = fs.readFileSync(path.join(root, "lib/last_keep/game/rules.ex"), "utf8")
  const simSource = fs.readFileSync(path.join(root, "lib/last_keep/game/sim.ex"), "utf8")
  const styleSource = fs.readFileSync(path.join(root, "STYLE.md"), "utf8")
  const rules = rulesFrom(rulesSource)
  const { tokens, cited, kinds } = styleTables(styleSource)
  problems.push(...coverageProblems(listed, rules))
  problems.push(...paletteProblems(listed, tokens))
  problems.push(...keepStoneProblems(listed, cited))
  problems.push(...styleProblems(listed, kinds))
  problems.push(...conceptProblems(listed))
  problems.push(...fitProblems(listed))
  problems.push(...radiusProblems(listed, rulesSource, simSource))
  problems.push(...uncitedPaletteProblems(styleSource))
  if (!styleSource.includes("fit slack is 2")) problems.push("STYLE.md does not record fit slack 2")
  if (!styleSource.includes("pixel threshold is 0")) problems.push("STYLE.md does not record pixel threshold 0")
  if (!styleSource.includes("0.85")) problems.push("STYLE.md does not record the silhouette IoU limit")
  if (!styleSource.includes(`voxel detail floor is ${detailFloor}`)) {
    problems.push(`STYLE.md does not record voxel detail floor ${detailFloor}`)
  }

  const present = {}
  const sheets = {}
  for (const sheet of conceptSheets) {
    const file = path.join(root, "docs/concept", sheet)
    present[sheet] = fs.existsSync(file)
    if (!present[sheet]) continue
    try {
      sheets[sheet] = loadSheet(file)
    } catch (error) {
      problems.push(`${sheet} did not decode: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  problems.push(...citationProblems(cited, sheets))
  if (sheets["theme.jpg"]) {
    problems.push(
      ...sceneColorProblems(styleSource, sheets["theme.jpg"], cited, galleryRigs, {
        ground: groundColor,
        sky: skyColor,
        plaza: plazaColor,
        path: pathColor,
        ring: ringColor
      })
    )
  }

  let rendered = []
  if (problems.length === 0) {
    try {
      const first = renderGallery(listed, sheets)
      const second = renderGallery(listed, sheets)
      const drift = galleryDiff(first, second)
      if (drift.length > 0) problems.push(...drift.map((item) => `second run differed: ${item}`))
      rendered = first
      problems.push(...silhouetteProblems(listed, first))
      problems.push(...nightLightProblems(listed, first))
      problems.push(...heroHeightProblems(listed))
      problems.push(...detailProblems(listed))
      problems.push(...closeupProblems(first))
      if (sheets["heroes.jpg"]) problems.push(...heroColorProblems(listed, sheets["heroes.jpg"]))
    } catch (error) {
      problems.push(`render threw: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const artifactDir = path.join(root, "artifacts/gallery")
  if (rendered.length > 0) {
    writeGallery(artifactDir, rendered, present, true)
    const again = fs.mkdtempSync(path.join(os.tmpdir(), "lk-gallery-"))
    try {
      writeGallery(again, renderGallery(listed, sheets), present, true)
      const written = directoryDiff(artifactDir, again)
      if (written.length > 0) problems.push(...written.map((item) => `artifacts/gallery differed: ${item}`))
    } finally {
      fs.rmSync(again, { recursive: true, force: true })
    }
  }

  const html = rendered.length > 0 ? galleryHtml(rendered, present, "../test/gallery/") : ""
  const htmlPath = path.join(root, "docs/gallery.html")
  const goldenDir = path.join(root, "test/gallery")

  if (writeGolden && rendered.length > 0 && problems.length === 0) {
    writeGallery(goldenDir, rendered, present, false)
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
    fs.writeFileSync(htmlPath, html)
    fs.mkdirSync(goldenDir, { recursive: true })
    fs.writeFileSync(path.join(goldenDir, "threshold.json"), `${JSON.stringify({ pixels: 0 }, null, 2)}\n`)
  } else if (rendered.length > 0) {
    const threshold = readThreshold()
    if (threshold !== 0) problems.push(`pixel threshold ${threshold} is not 0`)
    problems.push(...goldenProblems(goldenDir, rendered, threshold ?? 0))
    if (!fs.existsSync(htmlPath) || fs.readFileSync(htmlPath, "utf8") !== html) {
      problems.push("docs/gallery.html does not match this render")
    }
  }

  return { ok: problems.length === 0, problems, rendered, present }
}

function readThreshold() {
  const file = path.join(root, "test/gallery/threshold.json")
  if (!fs.existsSync(file)) return null
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  return parsed.pixels
}

const figureFamilies = new Set(["hero", "monster"])

export function renderGallery(listed, sheets) {
  return listed.map((model) => {
    const frames = {}
    for (const light of lightNames) frames[light] = renderParts(model.parts, light)
    const image = sheets[model.concept.sheet]
    const concept = image
      ? blitCrop(image, model.concept.crop, frames.day.width, frames.day.height)
      : missingConcept(frames.day.width, frames.day.height)
    const close = figureFamilies.has(model.family) ? renderCloseup(model.parts, "day") : null
    const panels = lightNames.map((light) => frames[light])
    if (close) panels.push(placeOn(close, close.width, frames.day.height, galleryRigs.day.bg))
    panels.push(concept)
    const sheet = stackHorizontal(panels)
    const portrait = close
    const compare = close ? stackHorizontal([close, conceptBeside(image, model.concept.crop, close.height)]) : null
    return {
      id: model.id,
      family: model.family,
      concept: model.concept,
      minArea: model.minArea,
      frames,
      conceptFrame: concept,
      closeup: close,
      compare,
      sheet,
      portrait,
      area: maskArea(frames.dusk.mask),
      luma: {
        day: meanLuma(frames.day),
        dusk: meanLuma(frames.dusk),
        night: meanLuma(frames.night)
      }
    }
  })
}

function conceptBeside(image, crop, height) {
  if (!image) return missingConcept(height, height)
  const width = Math.max(1, Math.round((crop.w * height) / crop.h))
  return blitCrop(image, crop, width, height)
}

function placeOn(image, width, height, bg) {
  const rgb = new Uint8Array(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = bg[0]
    rgb[i * 3 + 1] = bg[1]
    rgb[i * 3 + 2] = bg[2]
  }
  const x0 = Math.max(0, Math.floor((width - image.width) / 2))
  const y0 = Math.max(0, Math.floor((height - image.height) / 2))
  const copyW = Math.min(image.width, width)
  const copyH = Math.min(image.height, height)
  for (let y = 0; y < copyH; y++) {
    const src = (y * image.width) * 3
    rgb.set(image.rgb.subarray(src, src + copyW * 3), ((y0 + y) * width + x0) * 3)
  }
  return { rgb, width, height }
}

function cropRgb(sheet, crop) {
  const rgb = new Uint8Array(crop.w * crop.h * 3)
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const src = ((crop.y + y) * sheet.width + (crop.x + x)) * 4
      const dst = (y * crop.w + x) * 3
      rgb[dst] = sheet.data[src]
      rgb[dst + 1] = sheet.data[src + 1]
      rgb[dst + 2] = sheet.data[src + 2]
    }
  }
  return rgb
}

function quantize(rgb, width, height, mask, minLuma) {
  const bins = new Map()
  let total = 0
  for (let i = 0; i < width * height; i++) {
    if (mask && !mask[i]) continue
    const o = i * 3
    const r = rgb[o]
    const g = rgb[o + 1]
    const b = rgb[o + 2]
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < minLuma) continue
    total += 1
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    let bin = bins.get(key)
    if (!bin) {
      bin = { n: 0, r: 0, g: 0, b: 0 }
      bins.set(key, bin)
    }
    bin.n += 1
    bin.r += r
    bin.g += g
    bin.b += b
  }
  const colors = [...bins.values()].map((bin) => ({
    n: bin.n,
    rgb: [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n]
  }))
  colors.sort((a, b) => b.n - a.n)
  return { total, colors }
}

function rgbDist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function chromaDist(a, b) {
  const left = a[0] + a[1] + a[2] || 1
  const right = b[0] + b[1] + b[2] || 1
  return Math.hypot(a[0] / left - b[0] / right, a[1] / left - b[1] / right, a[2] / left - b[2] / right)
}

// A close-up color is dominant at 16% of the lit figure. It has to match one crop
// color that occupies at least 1.5% of the crop once the near-black backdrop is
// gone. RGB tolerance 52 leaves room for the day light. Chroma tolerance 0.09
// rejects a brown body that sits near a grey only because both are dark.
export const heroColorTolerance = 52
export const heroChromaTolerance = 0.09
const heroConceptLuma = 48
const heroConceptShare = 0.015
const heroCloseShare = 0.16

export function heroColorProblems(listed, sheet) {
  const problems = []
  if (!sheet) return ["hero color check is missing heroes.jpg"]
  for (const model of listed) {
    if (model.family !== "hero") continue
    const crop = model.concept && model.concept.crop
    if (!crop) {
      problems.push(`${model.id} has no concept crop for its colors`)
      continue
    }
    const concept = quantize(cropRgb(sheet, crop), crop.w, crop.h, null, heroConceptLuma)
    const close = renderCloseup(model.parts, "day")
    const shot = quantize(close.rgb, close.width, close.height, close.mask, 24)
    const samples = concept.colors.filter((color) => color.n >= concept.total * heroConceptShare)
    const keep = shot.colors.filter((color) => color.n >= shot.total * heroCloseShare)
    if (shot.total === 0 || keep.length === 0 || samples.length === 0) {
      problems.push(`${model.id} close-up has no comparable color`)
      continue
    }
    for (const color of keep) {
      let matched = false
      for (const sample of samples) {
        if (rgbDist(color.rgb, sample.rgb) <= heroColorTolerance && chromaDist(color.rgb, sample.rgb) <= heroChromaTolerance) {
          matched = true
          break
        }
      }
      if (!matched) {
        const hex = color.rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")
        problems.push(`${model.id} close-up #${hex} is outside the concept crop`)
      }
    }
  }
  return problems
}

export const heroPixelFloor = 24

export function heroHeightProblems(listed) {
  const problems = []
  for (const model of listed) {
    if (model.family !== "hero") continue
    for (const rank of [0, 4]) {
      const height = maskBounds(renderParts(model.parts, "day", rank)).height
      if (height < heroPixelFloor) {
        problems.push(`${model.id} rank ${rank} is ${height}px tall, below ${heroPixelFloor}`)
      }
    }
  }
  return problems
}

function closeupProblems(rendered) {
  const problems = []
  for (const row of rendered) {
    if (!figureFamilies.has(row.family)) continue
    if (!row.closeup) {
      problems.push(`${row.id} has no close-up`)
      continue
    }
    const height = maskBounds(row.closeup).height
    if (height < 64 || height > 96) {
      problems.push(`${row.id} close-up is ${height}px tall, outside 64–96`)
    }
    if (!row.portrait || pixelDiff(row.portrait.rgb, row.closeup.rgb) !== 0) {
      problems.push(`${row.id} portrait is not the close-up`)
    }
    if (!row.compare) problems.push(`${row.id} has no concept comparison`)
  }
  return problems
}

function nightLightProblems(listed, rendered) {
  const problems = []
  const key = new Set(
    listed
      .filter((model) => model.parts.some((part) => part.color === 0xeea821 || part.color === 0xf5751e))
      .map((model) => model.id)
  )
  for (const row of rendered) {
    if (!key.has(row.id)) continue
    const stats = nightContrast(row.frames.night)
    const floor = row.id === "keep" ? { max: 80, warm: 8, lift: 4 } : { max: 55, warm: 1, lift: 2 }
    if (stats.max < floor.max) {
      problems.push(`${row.id} night max luma ${stats.max.toFixed(1)} is below ${floor.max}`)
    }
    if (stats.warm < floor.warm) {
      problems.push(`${row.id} night has ${stats.warm} warm torch pixels, below ${floor.warm}`)
    }
    if (stats.mean < stats.bg + floor.lift) {
      problems.push(
        `${row.id} night body luma ${stats.mean.toFixed(1)} does not read above the sky ${stats.bg.toFixed(1)}`
      )
    }
  }
  return problems
}

function silhouetteProblems(listed, rendered) {
  const problems = []
  for (const row of rendered) {
    if (row.area <= 0) problems.push(`${row.id} silhouette is empty`)
    if (row.area < row.minArea) problems.push(`${row.id} silhouette area ${row.area} is below the recorded minimum ${row.minArea}`)
    if (row.minArea < row.area * 0.5) {
      problems.push(`${row.id} recorded minimum ${row.minArea} is below half of measured area ${row.area}`)
    }
    if (!(row.luma.night < row.luma.dusk && row.luma.dusk < row.luma.day)) {
      problems.push(
        `${row.id} lights are not ordered night < dusk < day (${row.luma.night.toFixed(2)}, ${row.luma.dusk.toFixed(2)}, ${row.luma.day.toFixed(2)})`
      )
    }
    if (!row.portrait && figureFamilies.has(row.family)) problems.push(`${row.id} has no close-up portrait`)
  }
  const families = ["hero", "monster", "building", "prop"]
  for (const family of families) {
    const rows = rendered.filter((row) => row.family === family)
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const score = maskIou(rows[i].frames.dusk.mask, rows[j].frames.dusk.mask)
        if (score >= iouLimit) {
          problems.push(`${rows[i].id} and ${rows[j].id} silhouette IoU ${score.toFixed(3)} is at or above ${iouLimit}`)
        }
      }
    }
  }
  return problems
}

function galleryDiff(first, second) {
  const problems = []
  if (first.length !== second.length) return ["gallery length"]
  for (let i = 0; i < first.length; i++) {
    const a = first[i]
    const b = second[i]
    for (const light of lightNames) {
      if (pixelDiff(a.frames[light].rgb, b.frames[light].rgb) !== 0) problems.push(`${a.id} ${light}`)
    }
    if (pixelDiff(a.sheet.rgb, b.sheet.rgb) !== 0) problems.push(`${a.id} sheet`)
    if (pixelDiff(a.conceptFrame.rgb, b.conceptFrame.rgb) !== 0) problems.push(`${a.id} concept`)
    if (Boolean(a.closeup) !== Boolean(b.closeup)) problems.push(`${a.id} close-up`)
    if (a.closeup && pixelDiff(a.closeup.rgb, b.closeup.rgb) !== 0) problems.push(`${a.id} close-up`)
    if (Boolean(a.compare) !== Boolean(b.compare)) problems.push(`${a.id} compare`)
    if (a.compare && pixelDiff(a.compare.rgb, b.compare.rgb) !== 0) problems.push(`${a.id} compare`)
    if (Boolean(a.portrait) !== Boolean(b.portrait)) problems.push(`${a.id} portrait`)
    if (a.portrait && pixelDiff(a.portrait.rgb, b.portrait.rgb) !== 0) problems.push(`${a.id} portrait`)
  }
  return problems
}

function writeGallery(dir, rendered, present, includeIndex) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  for (const row of rendered) {
    const folder = path.join(dir, row.id)
    fs.mkdirSync(folder, { recursive: true })
    for (const light of lightNames) fs.writeFileSync(path.join(folder, `${light}.png`), encodePng(row.frames[light]))
    fs.writeFileSync(path.join(folder, "sheet.png"), encodePng(row.sheet))
    fs.writeFileSync(path.join(folder, "concept.png"), encodePng(row.conceptFrame))
    if (row.closeup) fs.writeFileSync(path.join(folder, "closeup.png"), encodePng(row.closeup))
    if (row.compare) fs.writeFileSync(path.join(folder, "compare.png"), encodePng(row.compare))
    if (row.portrait) fs.writeFileSync(path.join(folder, "portrait.png"), encodePng(row.portrait))
  }
  const manifest = {
    threshold: 0,
    fitSlack,
    iouLimit,
    zoom: { css: [1280, 800], rank: 0 },
    conceptPresent: present,
    assets: rendered.map((row) => ({
      id: row.id,
      family: row.family,
      area: row.area,
      minArea: row.minArea,
      day: round(row.luma.day),
      dusk: round(row.luma.dusk),
      night: round(row.luma.night),
      sheet: row.concept.sheet,
      figure: row.concept.figure,
      crop: [row.concept.crop.x, row.concept.crop.y, row.concept.crop.w, row.concept.crop.h],
      conceptPresent: Boolean(present[row.concept.sheet])
    }))
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  if (includeIndex) fs.writeFileSync(path.join(dir, "index.html"), galleryHtml(rendered, present, "./"))
}

function goldenProblems(dir, rendered, threshold) {
  const problems = []
  if (threshold === null) return ["test/gallery/threshold.json is missing"]
  const expected = new Set(["threshold.json", "manifest.json"])
  for (const row of rendered) {
    for (const light of lightNames) expected.add(`${row.id}/${light}.png`)
    expected.add(`${row.id}/sheet.png`)
    expected.add(`${row.id}/concept.png`)
    if (row.closeup) expected.add(`${row.id}/closeup.png`)
    if (row.compare) expected.add(`${row.id}/compare.png`)
    if (row.portrait) expected.add(`${row.id}/portrait.png`)
  }
  if (!fs.existsSync(dir)) return ["test/gallery is missing"]
  const actual = new Set(walk(dir, dir))
  for (const file of expected) {
    if (!actual.has(file)) problems.push(`golden missing ${file}`)
  }
  for (const file of actual) {
    if (!expected.has(file)) problems.push(`unexpected golden ${file}`)
  }
  for (const row of rendered) {
    for (const name of [
      ...lightNames.map((light) => `${light}.png`),
      "sheet.png",
      "concept.png",
      ...(row.closeup ? ["closeup.png"] : []),
      ...(row.compare ? ["compare.png"] : []),
      ...(row.portrait ? ["portrait.png"] : [])
    ]) {
      const file = path.join(dir, row.id, name)
      if (!fs.existsSync(file)) continue
      const decoded = decodePng(fs.readFileSync(file))
      const current =
        name === "sheet.png"
          ? row.sheet
          : name === "concept.png"
            ? row.conceptFrame
            : name === "closeup.png"
              ? row.closeup
              : name === "compare.png"
                ? row.compare
                : name === "portrait.png"
                  ? row.portrait
                  : row.frames[name.slice(0, -4)]
      const diff = pixelDiff(decoded.rgb, current.rgb)
      if (diff > threshold) problems.push(`${row.id}/${name} differs by ${diff} pixels (threshold ${threshold})`)
    }
  }
  const manifestPath = path.join(dir, "manifest.json")
  if (fs.existsSync(manifestPath)) {
    const fresh = manifestText(rendered)
    if (fs.readFileSync(manifestPath, "utf8") !== fresh) problems.push("test/gallery/manifest.json does not match this render")
  }
  return problems
}

function manifestText(rendered) {
  const present = {}
  for (const sheet of conceptSheets) present[sheet] = fs.existsSync(path.join(root, "docs/concept", sheet))
  const manifest = {
    threshold: 0,
    fitSlack,
    iouLimit,
    zoom: { css: [1280, 800], rank: 0 },
    conceptPresent: present,
    assets: rendered.map((row) => ({
      id: row.id,
      family: row.family,
      area: row.area,
      minArea: row.minArea,
      day: round(row.luma.day),
      dusk: round(row.luma.dusk),
      night: round(row.luma.night),
      sheet: row.concept.sheet,
      figure: row.concept.figure,
      crop: [row.concept.crop.x, row.concept.crop.y, row.concept.crop.w, row.concept.crop.h],
      conceptPresent: Boolean(present[row.concept.sheet])
    }))
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function walk(dir, base) {
  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name)
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, base))
    else out.push(path.relative(base, abs).split(path.sep).join("/"))
  }
  return out
}

function directoryDiff(left, right) {
  const a = walk(left, left)
  const b = walk(right, right)
  const problems = []
  if (a.join("\n") !== b.join("\n")) problems.push("file list")
  for (const file of a) {
    if (!b.includes(file)) continue
    const la = fs.readFileSync(path.join(left, file))
    const lb = fs.readFileSync(path.join(right, file))
    if (!la.equals(lb)) problems.push(file)
  }
  return problems
}

export function galleryHtml(rendered, present, prefix) {
  const articles = rendered
    .map((row) => {
      const here = Boolean(present[row.concept.sheet])
      const crop = `${row.concept.crop.x},${row.concept.crop.y},${row.concept.crop.w},${row.concept.crop.h}`
      const concept = here
        ? `<img src="${prefix}${row.id}/concept.png" alt="${row.id} concept crop of ${row.concept.figure}">`
        : `<p class="miss">Concept slot for ${row.concept.sheet} (${row.concept.figure}) is empty. That sheet is not in the repo.</p>`
      const near = row.compare
        ? `<img class="near" src="${prefix}${row.id}/compare.png" alt="${row.id} close-up beside the concept">`
        : ""
      return `<article id="${row.id}">
<h2>${row.id}</h2>
<p>${row.family}. Figure ${row.concept.figure} on ${row.concept.sheet} at ${crop}. Silhouette ${row.area} pixels. Night ${round(row.luma.night)}, dusk ${round(row.luma.dusk)}, day ${round(row.luma.day)}.</p>
${near}
<img src="${prefix}${row.id}/sheet.png" alt="${row.id} day, dusk, night, close-up, and concept slot">
${concept}
</article>`
    })
    .join("\n")
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Last Keep gallery</title>
<style>
body { margin: 0; background: #140e12; color: #f3e6cf; font: 16px/1.45 sans-serif; }
main { padding: 24px; max-width: 1100px; }
img { image-rendering: pixelated; background: #1a140f; max-width: 100%; height: auto; display: block; margin: 8px 0; }
img.near { height: 384px; width: auto; max-width: none; }
.miss { border: 1px solid #6a4a30; padding: 12px; }
</style>
</head>
<body>
<main>
<h1>Gallery</h1>
<p><code>npm run models</code> wrote these frames at game zoom through the pixel path. Heroes and monsters also have a close-up, about ${closeupFigure}px tall, and the portrait card is that close-up. The pictures on this page are the goldens in <code>test/gallery/</code>. CI uploads the same bytes as <code>artifacts/gallery/</code>. A second run has to match. The concept sheets are ${conceptSheets.map((sheet) => `${sheet} (${present[sheet] ? "present" : "not in the repo"})`).join(", ")}. Do not invent a substitute sheet.</p>
${articles}
</main>
</body>
</html>
`
}

function round(value) {
  return Math.round(value * 100) / 100
}
