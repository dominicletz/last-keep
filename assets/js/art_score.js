// Fidelity scorer from docs/concepts/ART-PIPELINE.md.
// A frame is top-row-first RGB. A mask marks ink. A missing mask treats every pixel as ink.

export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))
  return sorted[index]
}

// Unique colors in each full 8×8 block, after channel // 16.
// A masked block counts only when at least half its pixels are ink.
export function blockPercentiles(rgb, width, height, mask) {
  const counts = []
  for (let y = 0; y + 8 <= height; y += 8) {
    for (let x = 0; x + 8 <= width; x += 8) {
      let ink = 0
      const seen = new Set()
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const i = (y + dy) * width + x + dx
          if (mask && !mask[i]) continue
          ink += 1
          const o = i * 3
          seen.add(((rgb[o] >> 4) << 8) | ((rgb[o + 1] >> 4) << 4) | (rgb[o + 2] >> 4))
        }
      }
      if (mask && ink < 32) continue
      if (!mask || ink > 0) counts.push(seen.size)
    }
  }
  return { p25: percentile(counts, 0.25), p50: percentile(counts, 0.5), blocks: counts.length }
}

// Share of horizontal neighbors, sampled every second pixel, whose luma differs by more than 28.
export function hardEdge(rgb, width, height, mask) {
  let pairs = 0
  let jumps = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x + 1 < width; x += 2) {
      const a = y * width + x
      const b = a + 1
      if (mask && (!mask[a] || !mask[b])) continue
      const la = luma(rgb[a * 3], rgb[a * 3 + 1], rgb[a * 3 + 2])
      const lb = luma(rgb[b * 3], rgb[b * 3 + 1], rgb[b * 3 + 2])
      pairs += 1
      if (Math.abs(la - lb) > 28) jumps += 1
    }
  }
  return pairs ? jumps / pairs : 0
}

function boxResize(rgb, width, height, mask, destW, destH) {
  const out = new Uint8Array(destW * destH * 3)
  const bits = new Uint8Array(destW * destH)
  for (let y = 0; y < destH; y++) {
    const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / destH))
    for (let x = 0; x < destW; x++) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / destW))
      const s = sy * width + sx
      const d = y * destW + x
      if (mask && !mask[s]) continue
      bits[d] = 1
      out[d * 3] = rgb[s * 3]
      out[d * 3 + 1] = rgb[s * 3 + 1]
      out[d * 3 + 2] = rgb[s * 3 + 2]
    }
  }
  return { rgb: out, mask: bits, width: destW, height: destH }
}

function inkBox(mask, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % width
    const y = (i / width) | 0
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (maxX < 0) return null
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function cropBox(rgb, width, mask, box) {
  const out = new Uint8Array(box.w * box.h * 3)
  const bits = new Uint8Array(box.w * box.h)
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const s = (box.minY + y) * width + box.minX + x
      const d = y * box.w + x
      if (mask && !mask[s]) continue
      bits[d] = 1
      out[d * 3] = rgb[s * 3]
      out[d * 3 + 1] = rgb[s * 3 + 1]
      out[d * 3 + 2] = rgb[s * 3 + 2]
    }
  }
  return { rgb: out, mask: bits, width: box.w, height: box.h }
}

function borderMask(rgb, width, height) {
  const r = rgb[0]
  const g = rgb[1]
  const b = rgb[2]
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) {
    const o = i * 3
    const L = luma(rgb[o], rgb[o + 1], rgb[o + 2])
    const border = luma(r, g, b)
    if (Math.abs(L - border) > 12) mask[i] = 1
  }
  return mask
}

// Luma SSIM. A figure matches itself at 1. The window is the whole registered box.
export function ssimLuma(left, right) {
  const n = left.width * left.height
  if (!n || left.width !== right.width || left.height !== right.height) return 0
  let meanA = 0
  let meanB = 0
  for (let i = 0; i < n; i++) {
    meanA += luma(left.rgb[i * 3], left.rgb[i * 3 + 1], left.rgb[i * 3 + 2])
    meanB += luma(right.rgb[i * 3], right.rgb[i * 3 + 1], right.rgb[i * 3 + 2])
  }
  meanA /= n
  meanB /= n
  let varA = 0
  let varB = 0
  let cov = 0
  for (let i = 0; i < n; i++) {
    const a = luma(left.rgb[i * 3], left.rgb[i * 3 + 1], left.rgb[i * 3 + 2]) - meanA
    const b = luma(right.rgb[i * 3], right.rgb[i * 3 + 1], right.rgb[i * 3 + 2]) - meanB
    varA += a * a
    varB += b * b
    cov += a * b
  }
  varA /= n
  varB /= n
  cov /= n
  const c1 = (0.01 * 255) ** 2
  const c2 = (0.03 * 255) ** 2
  return (2 * meanA * meanB + c1) * (2 * cov + c2) / ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2))
}

export function silhouetteIou(left, right) {
  const n = left.mask.length
  if (!n || n !== right.mask.length) return 0
  let inter = 0
  let union = 0
  for (let i = 0; i < n; i++) {
    const a = left.mask[i] ? 1 : 0
    const b = right.mask[i] ? 1 : 0
    inter += a & b
    union += a | b
  }
  return union ? inter / union : 0
}

function register(frame, crop) {
  const frameMask = frame.mask || borderMask(frame.rgb, frame.width, frame.height)
  const cropMask = crop.mask || borderMask(crop.rgb, crop.width, crop.height)
  const frameInk = inkBox(frameMask, frame.width, frame.height)
  const cropInk = inkBox(cropMask, crop.width, crop.height)
  if (!frameInk || !cropInk) return null
  const cut = cropBox(frame.rgb, frame.width, frameMask, frameInk)
  const painted = cropBox(crop.rgb, crop.width, cropMask, cropInk)
  return {
    frame: boxResize(cut.rgb, cut.width, cut.height, cut.mask, 64, 80),
    crop: boxResize(painted.rgb, painted.width, painted.height, painted.mask, 64, 80)
  }
}

export function registeredScores(frame, crop) {
  const pair = register(frame, crop)
  if (!pair) return { ssim: 0, iou: 0 }
  return { ssim: ssimLuma(pair.frame, pair.crop), iou: silhouetteIou(pair.frame, pair.crop) }
}

export function lockedPalette(hexes) {
  const colors = []
  for (const hex of hexes) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    for (const gain of [1, 0.65, 0.4]) {
      colors.push([
        Math.max(0, Math.min(255, Math.round(r * gain))),
        Math.max(0, Math.min(255, Math.round(g * gain))),
        Math.max(0, Math.min(255, Math.round(b * gain)))
      ])
    }
  }
  return colors
}

export function paletteMembership(rgb, width, height, mask, palette) {
  let ink = 0
  let hit = 0
  const n = width * height
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue
    ink += 1
    const o = i * 3
    const r = rgb[o]
    const g = rgb[o + 1]
    const b = rgb[o + 2]
    let near = false
    for (const color of palette) {
      const dr = r - color[0]
      const dg = g - color[1]
      const db = b - color[2]
      if (dr * dr + dg * dg + db * db <= 1) {
        near = true
        break
      }
    }
    if (near) hit += 1
  }
  return ink ? hit / ink : 0
}

export function scoreFrame(frame, crop, palette) {
  const mask = frame.mask || null
  const block = blockPercentiles(frame.rgb, frame.width, frame.height, mask)
  const registered = crop ? registeredScores(frame, crop) : { ssim: 1, iou: 1 }
  return {
    blockP25: block.p25,
    blockP50: block.p50,
    hardEdge: hardEdge(frame.rgb, frame.width, frame.height, mask),
    ssim: registered.ssim,
    iou: registered.iou,
    membership: palette ? paletteMembership(frame.rgb, frame.width, frame.height, mask, palette) : 0
  }
}

// Four luma bands of 64. That is inside the 3-to-5 value posterization.
// Spread counts bands that hold at least 2% of the frame.
// Focal contrast is the absolute gap between the median luma of the focal mask
// and the median luma of the ground mask. With no ground mask, the ground is
// every pixel that is not focal. Spread and contrast only rise.
const VALUE_BANDS = 4
const BAND_WIDTH = 64
const SPREAD_SHARE = 0.02

function medianLuma(hist, total) {
  if (!total) return 0
  let seen = 0
  const mid = (total - 1) >> 1
  for (let i = 0; i < hist.length; i++) {
    seen += hist[i]
    if (seen > mid) return i
  }
  return hist.length - 1
}

export function valueStructure(rgb, width, height, focal, ground) {
  const n = width * height
  const counts = [0, 0, 0, 0]
  const focalCounts = [0, 0, 0, 0]
  const groundCounts = [0, 0, 0, 0]
  const focalHist = new Uint32Array(256)
  const groundHist = new Uint32Array(256)
  let focalN = 0
  let groundN = 0
  for (let i = 0; i < n; i++) {
    const o = i * 3
    const tone = Math.max(0, Math.min(255, Math.round(luma(rgb[o], rgb[o + 1], rgb[o + 2]))))
    const band = Math.min(VALUE_BANDS - 1, (tone / BAND_WIDTH) | 0)
    counts[band] += 1
    const onFocal = focal ? focal[i] : 0
    if (onFocal) {
      focalCounts[band] += 1
      focalHist[tone] += 1
      focalN += 1
    }
    if (ground ? ground[i] : !onFocal) {
      groundCounts[band] += 1
      groundHist[tone] += 1
      groundN += 1
    }
  }
  let spread = 0
  const need = n * SPREAD_SHARE
  for (let band = 0; band < VALUE_BANDS; band++) {
    if (counts[band] >= need) spread += 1
  }
  const focalLuma = medianLuma(focalHist, focalN)
  const groundLuma = medianLuma(groundHist, groundN)
  return {
    levels: VALUE_BANDS,
    spread,
    focalContrast: focalN && groundN ? Math.abs(focalLuma - groundLuma) : 0,
    focalLuma,
    groundLuma,
    bands: counts,
    focalBands: focalCounts,
    groundBands: groundCounts
  }
}

// Live 640×400 camera, day dusk and night, measured before this floor.
// Day spread 2, dusk 3, night 2. Median luma gap 5, 10, and 5.
// Ground noise 8.93, 11.97, and 8.57. The concept clearing tile is 12.43.
// Spread and contrast only rise. The noise cap only falls.
export const valueFloor = { spread: 2, focalContrast: 5 }
export const noiseCap = 12

// Mean absolute luma step between horizontal neighbors. A mask keeps the step
// on those pixels. The concept clearing and the near yard both use this.
export function noiseEnergy(rgb, width, height, mask) {
  let pairs = 0
  let energy = 0
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x + 1 < width; x++) {
      const a = row + x
      const b = a + 1
      if (mask && (!mask[a] || !mask[b])) continue
      const oa = a * 3
      const ob = b * 3
      energy += Math.abs(
        luma(rgb[oa], rgb[oa + 1], rgb[oa + 2]) - luma(rgb[ob], rgb[ob + 1], rgb[ob + 2])
      )
      pairs += 1
    }
  }
  return pairs ? energy / pairs : 0
}
