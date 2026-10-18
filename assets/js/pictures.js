// Browser-safe hero card. The front cell is the concept crop. Eight directions
// and four walk frames are made from that one painting. Direction 0 is the crop.

export const spriteHeight = 32
export const spriteDirections = 8
export const spriteFrames = 4

const MARKS = {
  warrior: ["shoulders", "shield"],
  mage: ["robe", "hat", "staff"],
  scout: ["hood", "bow"],
  farmer: ["brim", "fork"],
  engineer: ["apron", "hammer"]
}

function mirror(image, gain) {
  const rgb = new Uint8Array(image.w * image.h * 3)
  const mask = new Uint8Array(image.w * image.h)
  for (let y = 0; y < image.h; y++) {
    for (let x = 0; x < image.w; x++) {
      const s = y * image.w + (image.w - 1 - x)
      if (!image.mask[s]) continue
      const d = y * image.w + x
      mask[d] = 1
      rgb[d * 3] = Math.round(image.rgb[s * 3] * gain)
      rgb[d * 3 + 1] = Math.round(image.rgb[s * 3 + 1] * gain)
      rgb[d * 3 + 2] = Math.round(image.rgb[s * 3 + 2] * gain)
    }
  }
  return { rgb, mask, w: image.w, h: image.h }
}

function squash(image, newW) {
  const w = Math.max(1, newW)
  const rgb = new Uint8Array(w * image.h * 3)
  const mask = new Uint8Array(w * image.h)
  for (let y = 0; y < image.h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(image.w - 1, Math.floor(((x + 0.5) * image.w) / w))
      const s = y * image.w + sx
      if (!image.mask[s]) continue
      const d = y * w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w, h: image.h }
}

function sideOf(image) {
  const slice = Math.max(1, Math.round(image.w * 0.2))
  const x0 = Math.floor((image.w - slice) / 2)
  const rgb = new Uint8Array(slice * image.h * 3)
  const mask = new Uint8Array(slice * image.h)
  for (let y = 0; y < image.h; y++) {
    for (let x = 0; x < slice; x++) {
      const s = y * image.w + x0 + x
      if (!image.mask[s]) continue
      const d = y * slice + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return squash({ rgb, mask, w: slice, h: image.h }, Math.max(4, Math.round(image.w * 0.22)))
}

function shift(image, dx, legsOnly) {
  const rgb = new Uint8Array(image.rgb.length)
  const mask = new Uint8Array(image.mask.length)
  const split = Math.floor(image.h * 0.55)
  for (let y = 0; y < image.h; y++) {
    const move = !legsOnly || y >= split
    const sy = y
    const ox = move ? dx : 0
    for (let x = 0; x < image.w; x++) {
      const sx = x - ox
      if (sx < 0 || sx >= image.w || sy < 0 || sy >= image.h) continue
      const s = sy * image.w + sx
      if (!image.mask[s]) continue
      const d = y * image.w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w: image.w, h: image.h }
}

function bob(image) {
  const rgb = new Uint8Array(image.rgb.length)
  const mask = new Uint8Array(image.mask.length)
  for (let y = 0; y < image.h; y++) {
    const sy = y + 1
    if (sy >= image.h) continue
    for (let x = 0; x < image.w; x++) {
      const s = sy * image.w + x
      if (!image.mask[s]) continue
      const d = y * image.w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w: image.w, h: image.h }
}

function directionsOf(front) {
  const three = squash(front, Math.max(4, Math.round(front.w * 0.72)))
  const threeBack = mirror(three, 1)
  const side = sideOf(front)
  const sideBack = mirror(side, 1)
  return [front, three, side, threeBack, mirror(front, 0.72), mirror(three, 0.72), sideBack, mirror(threeBack, 0.72)]
}

function walkOf(image) {
  return [image, shift(image, 2, true), bob(image), shift(image, -2, true)]
}

function paste(cellW, cellH, image) {
  const rgb = new Uint8Array(cellW * cellH * 3)
  const mask = new Uint8Array(cellW * cellH)
  const x0 = Math.floor((cellW - image.w) / 2)
  const y0 = Math.floor((cellH - image.h) / 2)
  for (let y = 0; y < image.h; y++) {
    for (let x = 0; x < image.w; x++) {
      const s = y * image.w + x
      if (!image.mask[s]) continue
      const dx = x0 + x
      const dy = y0 + y
      if (dx < 0 || dy < 0 || dx >= cellW || dy >= cellH) continue
      const d = dy * cellW + dx
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w: cellW, h: cellH }
}

/** @returns {any} */
export function buildCard(front, kind) {
  const views = directionsOf(front)
  const cellW = front.w
  const cellH = front.h
  const atlasW = cellW * spriteDirections
  const atlasH = cellH * spriteFrames
  const atlas = new Uint8Array(atlasW * atlasH * 4)
  const frames = []
  for (let dir = 0; dir < views.length; dir++) {
    const cycle = walkOf(views[dir])
    for (let frame = 0; frame < cycle.length; frame++) {
      const cell = paste(cellW, cellH, cycle[frame])
      frames.push(cell)
      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const s = y * cellW + x
          if (!cell.mask[s]) continue
          const dx = dir * cellW + x
          const dy = frame * cellH + y
          const d = (dy * atlasW + dx) * 4
          atlas[d] = cell.rgb[s * 3]
          atlas[d + 1] = cell.rgb[s * 3 + 1]
          atlas[d + 2] = cell.rgb[s * 3 + 2]
          atlas[d + 3] = 255
        }
      }
    }
  }
  const image = frames[0]
  let opaque = 0
  for (let i = 0; i < image.mask.length; i++) opaque += image.mask[i]
  const worldH = spriteHeight
  const worldW = Math.round((worldH * cellW * 10) / cellH) / 10
  const depth = Math.max(4, Math.round(worldW * 0.28 * 10) / 10)
  const part = {
    name: "picture",
    shape: "billboard",
    color: 0xd8cfc3,
    w: worldW,
    h: worldH,
    d: depth,
    x: 0,
    y: worldH / 2,
    z: 0,
    hold: 1,
    image,
    atlas,
    atlasW,
    atlasH,
    cellW,
    cellH,
    directions: spriteDirections,
    frames: spriteFrames
  }
  const parts = /** @type {any} */ ([part])
  parts.marks = MARKS[kind].slice()
  parts.voxelCount = opaque
  parts.bounds = { w: worldW, h: worldH, d: depth }
  return parts
}


export function pictureColumn(viewYaw, facing) {
  const turn = Math.PI * 2
  let rel = viewYaw + facing - Math.PI / 4
  rel = ((rel % turn) + turn) % turn
  return Math.round(rel / (Math.PI / 4)) % spriteDirections
}
