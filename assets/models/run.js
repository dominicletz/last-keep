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
  paletteProblems,
  radiusProblems,
  rulesFrom,
  styleProblems,
  styleTables
} from "./registry.js"
import {
  cropMask,
  decodePng,
  encodePng,
  lightNames,
  maskArea,
  maskIou,
  meanLuma,
  missingConcept,
  pixelDiff,
  renderParts,
  stackHorizontal
} from "./raster.js"

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
  const { tokens, kinds } = styleTables(styleSource)
  problems.push(...coverageProblems(listed, rules))
  problems.push(...paletteProblems(listed, tokens))
  problems.push(...styleProblems(listed, kinds))
  problems.push(...conceptProblems(listed))
  problems.push(...fitProblems(listed))
  problems.push(...radiusProblems(listed, rulesSource, simSource))
  if (!styleSource.includes("fit slack is 2")) problems.push("STYLE.md does not record fit slack 2")
  if (!styleSource.includes("pixel threshold is 0")) problems.push("STYLE.md does not record pixel threshold 0")
  if (!styleSource.includes("0.85")) problems.push("STYLE.md does not record the silhouette IoU limit")

  const present = {}
  for (const sheet of conceptSheets) {
    present[sheet] = fs.existsSync(path.join(root, "docs/concept", sheet))
  }

  let rendered = []
  if (problems.length === 0) {
    try {
      const first = renderGallery(listed, present)
      const second = renderGallery(listed, present)
      const drift = galleryDiff(first, second)
      if (drift.length > 0) problems.push(...drift.map((item) => `second run differed: ${item}`))
      rendered = first
      problems.push(...silhouetteProblems(listed, first))
    } catch (error) {
      problems.push(`render threw: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const artifactDir = path.join(root, "artifacts/gallery")
  if (rendered.length > 0) {
    writeGallery(artifactDir, rendered, present, true)
    const again = fs.mkdtempSync(path.join(os.tmpdir(), "lk-gallery-"))
    try {
      writeGallery(again, renderGallery(listed, present), present, true)
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

export function renderGallery(listed, present) {
  return listed.map((model) => {
    const frames = {}
    for (const light of lightNames) frames[light] = renderParts(model.parts, light)
    const concept = present[model.concept.sheet]
      ? { note: "present" }
      : missingConcept(frames.day.width, frames.day.height)
    const panels = lightNames.map((light) => frames[light])
    panels.push(concept.rgb ? concept : missingConcept(frames.day.width, frames.day.height))
    const sheet = stackHorizontal(panels)
    const portrait = model.family === "hero" ? cropMask(frames.dusk) : null
    return {
      id: model.id,
      family: model.family,
      concept: model.concept,
      minArea: model.minArea,
      frames,
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
    if (!row.portrait && row.family === "hero") problems.push(`${row.id} has no dusk portrait`)
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
    for (const name of [...lightNames.map((light) => `${light}.png`), "sheet.png", ...(row.portrait ? ["portrait.png"] : [])]) {
      const file = path.join(dir, row.id, name)
      if (!fs.existsSync(file)) continue
      const decoded = decodePng(fs.readFileSync(file))
      const current = name === "sheet.png" ? row.sheet : name === "portrait.png" ? row.portrait : row.frames[name.slice(0, -4)]
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
      const concept = here
        ? `<img src="../docs/concept/${row.concept.sheet}" alt="concept sheet ${row.concept.sheet}">`
        : `<p class="miss">Concept slot for ${row.concept.sheet} (${row.concept.figure}) is empty. That sheet is not in the repo.</p>`
      const portrait =
        row.family === "hero"
          ? `<img src="${prefix}${row.id}/portrait.png" alt="${row.id} dusk portrait">`
          : ""
      return `<article id="${row.id}">
<h2>${row.id}</h2>
<p>${row.family}. Figure ${row.concept.figure} on ${row.concept.sheet}. Silhouette ${row.area} pixels. Night ${round(row.luma.night)}, dusk ${round(row.luma.dusk)}, day ${round(row.luma.day)}.</p>
<img src="${prefix}${row.id}/sheet.png" alt="${row.id} day, dusk, night, and concept slot">
${portrait}
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
.miss { border: 1px solid #6a4a30; padding: 12px; }
</style>
</head>
<body>
<main>
<h1>Gallery</h1>
<p><code>npm run models</code> wrote these frames at game zoom through the pixel path. The pictures on this page are the goldens in <code>test/gallery/</code>. CI uploads the same bytes as <code>artifacts/gallery/</code>. A second run has to match. The concept sheets are ${conceptSheets.map((sheet) => `${sheet} (${present[sheet] ? "present" : "not in the repo"})`).join(", ")}. Do not invent a substitute sheet.</p>
${articles}
</main>
</body>
</html>
`
}

function round(value) {
  return Math.round(value * 100) / 100
}
