// Browser-safe HD-2D frame scores. The file writer stays in hd2d_score.js.

const C1 = (0.01 * 255) ** 2
const C2 = (0.03 * 255) ** 2

export function lumaOf(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function lumaAt(frame, x, y) {
  const xx = Math.max(0, Math.min(frame.width - 1, x))
  const yy = Math.max(0, Math.min(frame.height - 1, y))
  const o = (yy * frame.width + xx) * 4
  return lumaOf(frame.rgba[o], frame.rgba[o + 1], frame.rgba[o + 2])
}

function chromaAt(frame, x, y) {
  const xx = Math.max(0, Math.min(frame.width - 1, x))
  const yy = Math.max(0, Math.min(frame.height - 1, y))
  const o = (yy * frame.width + xx) * 4
  const r = frame.rgba[o]
  const g = frame.rgba[o + 1]
  const b = frame.rgba[o + 2]
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function clip(frame, rect) {
  const x0 = Math.max(0, rect.x | 0)
  const y0 = Math.max(0, rect.y | 0)
  const x1 = Math.min(frame.width, (rect.x | 0) + (rect.w | 0))
  const y1 = Math.min(frame.height, (rect.y | 0) + (rect.h | 0))
  return { x0, y0, x1, y1 }
}

function mean(frame, rect, sample) {
  const { x0, y0, x1, y1 } = clip(frame, rect)
  let acc = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      acc += sample(frame, x, y)
      n += 1
    }
  }
  return n ? acc / n : 0
}

function meanLuma(frame, rect) {
  return mean(frame, rect, lumaAt)
}

function boxMae(frame, rect) {
  const { x0, y0, x1, y1 } = clip(frame, rect)
  let acc = 0
  let n = 0
  for (let y = y0; y + 1 < y1; y += 2) {
    for (let x = x0; x + 1 < x1; x += 2) {
      const samples = [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1]
      ]
      let box = 0
      for (const [sx, sy] of samples) box += lumaAt(frame, sx, sy)
      box /= 4
      for (const [sx, sy] of samples) {
        acc += Math.abs(lumaAt(frame, sx, sy) - box)
        n += 1
      }
    }
  }
  return n ? acc / n : 0
}

function sharpness(frame, rect) {
  return 1 - boxMae(frame, rect) / 255
}

function stepEnergy(frame, rect) {
  const { x0, y0, x1, y1 } = clip(frame, rect)
  let acc = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x + 1 < x1; x++) {
      acc += Math.abs(lumaAt(frame, x + 1, y) - lumaAt(frame, x, y))
      n += 1
    }
  }
  return n ? acc / n : 0
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function ssim(left, right) {
  if (!left || !right || left.width !== right.width || left.height !== right.height) throw new Error("ssim size")
  const window = 8
  let sum = 0
  let count = 0
  for (let y = 0; y + window <= left.height; y += window) {
    for (let x = 0; x + window <= left.width; x += window) {
      let muA = 0
      let muB = 0
      const n = window * window
      for (let yy = 0; yy < window; yy++) {
        for (let xx = 0; xx < window; xx++) {
          muA += lumaAt(left, x + xx, y + yy)
          muB += lumaAt(right, x + xx, y + yy)
        }
      }
      muA /= n
      muB /= n
      let varA = 0
      let varB = 0
      let cov = 0
      for (let yy = 0; yy < window; yy++) {
        for (let xx = 0; xx < window; xx++) {
          const a = lumaAt(left, x + xx, y + yy) - muA
          const b = lumaAt(right, x + xx, y + yy) - muB
          varA += a * a
          varB += b * b
          cov += a * b
        }
      }
      varA /= n
      varB /= n
      cov /= n
      sum += ((2 * muA * muB + C1) * (2 * cov + C2)) / ((muA * muA + muB * muB + C1) * (varA + varB + C2))
      count += 1
    }
  }
  return count ? sum / count : 1
}

export function stillRects(width, height) {
  const heroW = Math.max(8, Math.round(width * 0.08))
  const heroH = Math.max(8, Math.round(height * 0.22))
  return {
    heroes: [
      { x: Math.round(width * 0.4), y: Math.round(height * 0.42), w: heroW, h: heroH },
      { x: Math.round(width * 0.52), y: Math.round(height * 0.4), w: heroW, h: heroH }
    ],
    near: { x: Math.round(width * 0.28), y: Math.round(height * 0.72), w: Math.round(width * 0.44), h: Math.round(height * 0.12) },
    far: { x: Math.round(width * 0.04), y: Math.round(height * 0.02), w: Math.round(width * 0.28), h: Math.round(height * 0.12) },
    torch: { x: Math.round(width * 0.46), y: Math.round(height * 0.52), w: Math.round(width * 0.14), h: Math.round(height * 0.12) },
    flame: { x: Math.round(width * 0.47), y: Math.round(height * 0.28), w: Math.max(8, Math.round(width * 0.05)), h: Math.max(8, Math.round(height * 0.05)) },
    quads: [{ x: Math.round(width * 0.43), y: Math.round(height * 0.62), w: Math.max(4, Math.round(width * 0.04)), h: Math.max(4, Math.round(height * 0.025)) }]
  }
}

export function clockScore(clock, frame, rects) {
  const box = rects || stillRects(frame.width, frame.height)
  const heroes = box.heroes || []
  if (clock === "day") {
    const focal = average(heroes.map((rect) => sharpness(frame, rect)))
    const heroEnergy = average(heroes.map((rect) => stepEnergy(frame, rect)))
    const quads = box.quads || []
    const shadows = quads.length
      ? average(quads.map((quad) => meanLuma(frame, { x: quad.x + quad.w, y: quad.y, w: quad.w, h: quad.h }) - meanLuma(frame, quad)))
      : 0
    return {
      crisp: focal - sharpness(frame, box.far),
      miniature: heroEnergy / Math.max(stepEnergy(frame, box.near), stepEnergy(frame, box.far), 1e-3),
      shadows
    }
  }
  if (clock === "dusk") {
    return {
      chroma: average(heroes.map((rect) => mean(frame, rect, chromaAt))) - mean(frame, box.far, chromaAt)
    }
  }
  if (clock === "night") {
    let cap = 0
    for (let i = 0; i < frame.rgba.length; i += 4) {
      const value = lumaOf(frame.rgba[i], frame.rgba[i + 1], frame.rgba[i + 2])
      if (value > cap) cap = value
    }
    const flame = box.flame
    const haloRect = { x: flame.x - 12, y: flame.y - 12, w: flame.w + 24, h: flame.h + 24 }
    const { x0, y0, x1, y1 } = clip(frame, haloRect)
    const inner = clip(frame, flame)
    let haloAcc = 0
    let haloN = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1) continue
        haloAcc += lumaAt(frame, x, y)
        haloN += 1
      }
    }
    return {
      pools: meanLuma(frame, box.torch) - meanLuma(frame, box.far),
      cap,
      halo: (haloN ? haloAcc / haloN : 0) - meanLuma(frame, box.far)
    }
  }
  throw new Error("unknown clock")
}

export function scoreChecks(frames, rects) {
  const box = rects || stillRects(frames.day.width, frames.day.height)
  const day = clockScore("day", frames.day, box)
  const dusk = clockScore("dusk", frames.dusk, box)
  const night = clockScore("night", frames.night, box)
  const heroes = box.heroes || []
  const lit = heroes.length ? Math.min(...heroes.map((rect) => meanLuma(frames.day, rect) - meanLuma(frames.night, rect))) : 0
  return {
    3: { crisp: day.crisp },
    4: { miniature: day.miniature },
    5: { lit },
    6: { shadows: day.shadows },
    7: { pools: night.pools },
    8: { cap: night.cap, halo: night.halo },
    9: { chroma: dusk.chroma },
    10: { ssim: null, reference: true }
  }
}

