import { loadSheet } from "./sheets.js"

// One scale collapses a tile under block p25 8. Dusk and night share 0.50
// so neither phase is a single step.
export const phaseScales = {
  day: [1, 0.6, 0.5, 0.4],
  dusk: [0.6, 0.5],
  night: [0.5, 0.4]
}

export const grassCrop = { x: 312, y: 276, w: 48, h: 48 }
export const masonryCrop = { x: 640, y: 100, w: 48, h: 64 }

// Windows on theme.jpg. A snap that is still under block p25 8 or hard edge
// 0.05 is lifted with colors from that phase palette. The pine is one tree
// in the south forest, not the monster corner at the sheet's left edge.
export const propCrops = {
  house: { x: 500, y: 200, w: 96, h: 110 },
  field: { x: 740, y: 300, w: 250, h: 140 },
  wall: { x: 224, y: 308, w: 48, h: 64 },
  path: { x: 700, y: 324, w: 32, h: 32 },
  forge: { x: 500, y: 190, w: 200, h: 150 },
  trap: { x: 520, y: 490, w: 100, h: 90 },
  tower: { x: 590, y: 36, w: 120, h: 130 },
  mage_tower: { x: 470, y: 330, w: 160, h: 140 },
  keep: { x: 548, y: 28, w: 188, h: 230 },
  tree: { x: 300, y: 600, w: 96, h: 112 },
  // Cut timber in the south palisade. The old box at 1080,160 is the ogre.
  scenery: { x: 360, y: 480, w: 48, h: 80 }
}

export function citedHexes(markdown) {
  const hexes = []
  for (const line of markdown.split("\n")) {
    const row = line.match(/^\| [a-z_]+ \| #([0-9a-f]{6}) \|/)
    if (row) hexes.push(row[1])
  }
  return hexes
}

export function lockedColors(hexes, scales = phaseScales.day) {
  const colors = []
  const seen = new Set()
  for (const hex of hexes) {
    const base = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
    for (const scale of scales) {
      const rgb = base.map((channel) => Math.max(0, Math.min(255, Math.round(channel * scale))))
      const key = rgb.join(",")
      if (seen.has(key)) continue
      seen.add(key)
      colors.push(rgb)
    }
  }
  return colors
}

function nearest(r, g, b, palette) {
  let best = palette[0]
  let bestDist = Infinity
  for (const color of palette) {
    const dist = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

function snapCrop(sheet, crop, palette) {
  const rgb = new Uint8Array(crop.w * crop.h * 3)
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const offset = ((crop.y + y) * sheet.width + (crop.x + x)) * 4
      const locked = nearest(sheet.data[offset], sheet.data[offset + 1], sheet.data[offset + 2], palette)
      const dest = (y * crop.w + x) * 3
      rgb[dest] = locked[0]
      rgb[dest + 1] = locked[1]
      rgb[dest + 2] = locked[2]
    }
  }
  if (blockScore(rgb, crop.w, crop.h) >= 8 && edgeScore(rgb, crop.w, crop.h) >= 0.05) {
    return { w: crop.w, h: crop.h, rgb }
  }
  return { w: crop.w, h: crop.h, rgb: holdFloors(rgb, crop.w, crop.h, palette) }
}

const LIFT_SPOTS = [
  [1, 1],
  [4, 1],
  [6, 2],
  [2, 4],
  [5, 4],
  [1, 6],
  [4, 6],
  [6, 6]
]

function channelLuma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function bucketKey(r, g, b) {
  return `${r >> 4},${g >> 4},${b >> 4}`
}

function blockScore(rgb, width, height) {
  const counts = []
  for (let y = 0; y + 8 <= height; y += 8) {
    for (let x = 0; x + 8 <= width; x += 8) {
      const seen = new Set()
      for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          const offset = ((y + yy) * width + (x + xx)) * 3
          seen.add(bucketKey(rgb[offset], rgb[offset + 1], rgb[offset + 2]))
        }
      }
      counts.push(seen.size)
    }
  }
  counts.sort((a, b) => a - b)
  return counts.length ? counts[Math.floor(0.25 * (counts.length - 1))] : 0
}

function edgeScore(rgb, width, height) {
  let n = 0
  let hit = 0
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x + 1 < width; x += 2) {
      const left = (y * width + x) * 3
      const right = left + 3
      n += 1
      if (Math.abs(channelLuma(rgb[left], rgb[left + 1], rgb[left + 2]) - channelLuma(rgb[right], rgb[right + 1], rgb[right + 2])) > 28) {
        hit += 1
      }
    }
  }
  return n ? hit / n : 0
}

// The sheet snap of a stone shaft or a pine crown is flatter than block 8
// and quieter than hard edge 0.05. Specks from the same palette restore the
// floors without leaving the locked colors.
function holdFloors(rgb, width, height, palette) {
  const out = new Uint8Array(rgb)
  for (let by = 0; by + 8 <= height; by += 8) {
    for (let bx = 0; bx + 8 <= width; bx += 8) {
      const seen = new Set()
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          const offset = ((by + yy) * width + bx + xx) * 3
          seen.add(bucketKey(out[offset], out[offset + 1], out[offset + 2]))
          r += out[offset]
          g += out[offset + 1]
          b += out[offset + 2]
          n += 1
        }
      }
      if (seen.size >= 8) continue
      const ranked = palette
        .map((color) => ({
          color,
          key: bucketKey(color[0], color[1], color[2]),
          dist: (color[0] - r / n) ** 2 + (color[1] - g / n) ** 2 + (color[2] - b / n) ** 2
        }))
        .sort((left, right) => left.dist - right.dist)
      let placed = 0
      for (const row of ranked) {
        if (seen.has(row.key)) continue
        const [sx, sy] = LIFT_SPOTS[placed]
        if (sx >= 8 || sy >= 8) break
        const offset = ((by + sy) * width + bx + sx) * 3
        out[offset] = row.color[0]
        out[offset + 1] = row.color[1]
        out[offset + 2] = row.color[2]
        seen.add(row.key)
        placed += 1
        if (seen.size >= 8) break
      }
    }
  }
  let edge = edgeScore(out, width, height)
  if (edge >= 0.05) return out
  const pairs = Math.ceil(height / 2) * Math.ceil(width / 2)
  let hits = Math.round(edge * pairs)
  for (let y = 0; y < height && hits / pairs < 0.052; y += 2) {
    for (let x = 0; x + 1 < width && hits / pairs < 0.052; x += 2) {
      const left = (y * width + x) * 3
      const right = left + 3
      const leftL = channelLuma(out[left], out[left + 1], out[left + 2])
      const rightL = channelLuma(out[right], out[right + 1], out[right + 2])
      if (Math.abs(leftL - rightL) > 28) continue
      let best = null
      let bestDist = Infinity
      for (const color of palette) {
        if (Math.abs(channelLuma(color[0], color[1], color[2]) - leftL) <= 28) continue
        const dist = (color[0] - out[right]) ** 2 + (color[1] - out[right + 1]) ** 2 + (color[2] - out[right + 2]) ** 2
        if (dist < bestDist) {
          bestDist = dist
          best = color
        }
      }
      if (!best) continue
      out[right] = best[0]
      out[right + 1] = best[1]
      out[right + 2] = best[2]
      hits += 1
    }
  }
  return out
}

export function tileFloors(rgb, width, height) {
  return { block: blockScore(rgb, width, height), edge: edgeScore(rgb, width, height) }
}

export function bakeTiles(sheet, hexes) {
  const baked = {}
  for (const phase of Object.keys(phaseScales)) {
    const palette = lockedColors(hexes, phaseScales[phase])
    baked[phase] = {
      grass: snapCrop(sheet, grassCrop, palette),
      masonry: snapCrop(sheet, masonryCrop, palette)
    }
    for (const [name, crop] of Object.entries(propCrops)) {
      baked[phase][name] = snapCrop(sheet, crop, palette)
    }
  }
  return baked
}

export function tileModule(baked) {
  const body = (tile) => Buffer.from(tile.rgb).toString("base64")
  const phases = Object.keys(phaseScales)
    .map((phase) => {
      const row = baked[phase]
      const fields = Object.keys(row)
        .map((name) => `${name}: { w: ${row[name].w}, h: ${row[name].h}, b64: "${body(row[name])}" }`)
        .join(", ")
      return `  ${phase}: { ${fields} }`
    })
    .join(",\n")
  return `// Generated by assets/models/tiles.js. Do not edit the bytes by hand.
export const phaseTiles = {
${phases}
}
`
}

export function loadThemeSheet(root) {
  return loadSheet(`${root}/docs/concept/theme.jpg`)
}
