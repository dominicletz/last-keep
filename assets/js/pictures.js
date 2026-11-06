// Browser-safe hero card. The front cell is the concept crop. Eight directions,
// four walk frames, three attack frames, and four death frames are made from
// that one painting. Direction 0, walk 0 is the crop. A hero's side column is
// a profile of that painting, with the left-hand gear in front of the body.

export const spriteHeight = 32
export const spriteDirections = 8
export const spriteWalk = 4
export const spriteAttack = 3
export const spriteDeath = 4
export const spriteFrames = spriteWalk + spriteAttack + spriteDeath

// The yard shows the card at about 33 internal pixels, and the close-up frames
// it at 80. A 160px source keeps that close-up under the likeness ceiling.
// The full crop's atlas is about 46MB and stalls the page.
export const cardSourceHeight = 160

// Heroes drawn from a video walk sheet (docs/concepts/SPRITE-PIPELINE.md)
// instead of the voxel atlas, in lighting priority order.
export const SHEET_HEROES = ["warrior", "mage", "scout", "farmer", "engineer"]

export function walkSheetUrl(hero, normal = false) {
  return `images/hd2d/${hero}-walk${normal ? "-normal" : ""}.png`
}

// A passing hero sheet is 24 rows: walk, attack, death, idle. A sheet that
// failed precheck stays 12 rows, walk then idle, and does not play a swing.
// imageHeight is the texture's pixel height. Anything that is not 24 cells
// (the 1px stand-in in tests, a 12-row sheet) keeps the walk and idle layout.
export function heroSheetLayout(imageHeight) {
  if (imageHeight === 128 * 24) {
    return { directions: 8, frames: 24, walk: 8, attack: 6, death: 6, idle: 4 }
  }
  return { directions: 8, frames: 12, walk: 8, attack: 0, death: 0, idle: 4 }
}

// Monster sheets from script/sprite_from_video.py and assets/reference/<kind>/asset.json.
// Eight direction columns. Rows run walk, attack, then death, top to bottom.
// A square cell of `cell` px, the figure `figure` px tall at the start pose,
// and its lowest outline row is `footRow`. The texel is the hero's, so the
// goblin's and the skeleton's pixels are the same size as the heroes'
// (docs/ART-REDO.md). The skeleton's wider cell holds the slash and the heap;
// the wolf's 128 px cell holds its side-on length, the lunge and the body lying flat.
// The bat is a flier: its 128 px cell holds the spread wings, and its foot line
// (row 104, outline row 105) sits 24 px over the cell bottom so the wings'
// downstroke stays inside the cell.
// render.js lifts it (flierLift) and drops it to the ground through its death row.
// The troll is the one walker taller than a hero (34 world units, under 1.75
// keep doors): its 160 px cell holds the club slammed over his head and the
// body lying flat across the frame.
export const MONSTER_SHEETS = {
  goblin: { cell: 80, figure: 50, footRow: 73, rows: { walk: 8, attack: 6, death: 6 } },
  skeleton: { cell: 88, figure: 60, footRow: 81, rows: { walk: 8, attack: 6, death: 6 } },
  wolf: { cell: 128, figure: 50, footRow: 121, rows: { walk: 8, attack: 6, death: 6 } },
  bat: { cell: 128, figure: 44, footRow: 105, rows: { walk: 8, attack: 6, death: 6 } },
  troll: { cell: 160, figure: 94, footRow: 153, rows: { walk: 8, attack: 6, death: 6 } },
  // The dark rider and his horse: 94 px like the troll, in a 192 px cell for
  // the side-on horse, the halberd chop over the helm and the horse lying flat.
  boss: { cell: 192, figure: 94, footRow: 185, rows: { walk: 8, attack: 6, death: 6 } },
  // A person at the hero height. Walk on eight directions, idle on the four
  // cardinals. The snapshot sends vagrants; render.js draws this sheet.
  vagrant: { cell: 128, figure: 88, footRow: 121, rows: { walk: 8, idle: 4 } }
}

export function monsterSheetUrl(kind) {
  return `images/hd2d/${kind}-sheet.png`
}

export function scaleFront(image, height) {
  const h = Math.max(1, height)
  const w = Math.max(1, Math.round((image.w * h) / image.h))
  const rgb = new Uint8Array(w * h * 3)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(image.h - 1, Math.floor(((y + 0.5) * image.h) / h))
    for (let x = 0; x < w; x++) {
      const sx = Math.min(image.w - 1, Math.floor(((x + 0.5) * image.w) / w))
      const s = sy * image.w + sx
      if (!image.mask[s]) continue
      const d = y * w + x
      mask[d] = 1
      rgb[d * 3] = image.rgb[s * 3]
      rgb[d * 3 + 1] = image.rgb[s * 3 + 1]
      rgb[d * 3 + 2] = image.rgb[s * 3 + 2]
    }
  }
  return { rgb, mask, w, h }
}

const MARKS = {
  warrior: ["shoulders", "shield"],
  mage: ["robe", "hat", "staff"],
  scout: ["hood", "bow"],
  farmer: ["brim", "fork"],
  engineer: ["apron", "hammer"],
  goblin: ["ears", "spear"],
  skeleton: ["ribs", "blade"],
  wolf: ["muzzle", "tail"],
  troll: ["tusks", "club"],
  bat: ["wings", "fangs"],
  boss: ["helm", "horse"]
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

const HERO_KINDS = new Set(["warrior", "mage", "scout", "farmer", "engineer"])

function paintStrip(image, y, x0, x1, destX, destW, rgb, mask, destWidth) {
  if (destW <= 0 || x1 <= x0) return
  const span = x1 - x0
  for (let i = 0; i < destW; i++) {
    const sx = Math.min(x1 - 1, x0 + Math.floor(((i + 0.5) * span) / destW))
    const s = y * image.w + sx
    if (sx < 0 || sx >= image.w || !image.mask[s]) continue
    const dx = destX + i
    if (dx < 0 || dx >= destWidth) continue
    const d = y * destWidth + dx
    mask[d] = 1
    rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
  }
}

// A profile keeps the left-hand gear in front of the body and the right-hand
// pack behind it. A center slice of the painting drops that gear.
function profileOf(image) {
  const w = Math.max(8, Math.round(image.w * 0.48))
  const rgb = new Uint8Array(w * image.h * 3)
  const mask = new Uint8Array(w * image.h)
  for (let y = 0; y < image.h; y++) {
    let minX = image.w
    let maxX = -1
    for (let x = 0; x < image.w; x++) {
      if (!image.mask[y * image.w + x]) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    if (maxX < 0) continue
    const span = maxX - minX + 1
    const rowW = Math.max(1, Math.min(w, Math.round((w * span) / image.w)))
    const bodyW = Math.max(1, Math.round(rowW * 0.46))
    const leadW = Math.floor((rowW - bodyW) / 2)
    const trailW = rowW - bodyW - leadW
    const bodyX = Math.floor((w - bodyW) / 2)
    const leadEnd = minX + Math.floor(span * 0.28)
    const trailStart = minX + Math.ceil(span * 0.72)
    paintStrip(image, y, minX, Math.max(leadEnd, minX + 1), bodyX - leadW, leadW, rgb, mask, w)
    paintStrip(image, y, leadEnd, Math.max(trailStart, leadEnd + 1), bodyX, bodyW, rgb, mask, w)
    paintStrip(image, y, trailStart, maxX + 1, bodyX + bodyW, trailW, rgb, mask, w)
  }
  return { rgb, mask, w, h: image.h }
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

function directionsOf(front, kind) {
  const three = squash(front, Math.max(4, Math.round(front.w * 0.72)))
  const threeBack = mirror(three, 1)
  const side = HERO_KINDS.has(kind) ? profileOf(front) : sideOf(front)
  const sideBack = mirror(side, 1)
  return [front, three, side, threeBack, mirror(front, 0.72), mirror(three, 0.72), sideBack, mirror(threeBack, 0.72)]
}

function walkOf(image) {
  return [image, shift(image, 2, true), bob(image), shift(image, -2, true)]
}

function shiftUpper(image, dx) {
  const rgb = new Uint8Array(image.rgb.length)
  const mask = new Uint8Array(image.mask.length)
  const split = Math.floor(image.h * 0.55)
  for (let y = 0; y < image.h; y++) {
    const ox = y < split ? dx : 0
    for (let x = 0; x < image.w; x++) {
      const sx = x - ox
      if (sx < 0 || sx >= image.w) continue
      const s = y * image.w + sx
      if (!image.mask[s]) continue
      const d = y * image.w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w: image.w, h: image.h }
}

function attackOf(image) {
  return [image, shiftUpper(image, 4), shiftUpper(image, 7)]
}

function fall(image, scaleY) {
  const rgb = new Uint8Array(image.rgb.length)
  const mask = new Uint8Array(image.mask.length)
  const span = Math.max(1, image.h - 1)
  const lean = Math.round((1 - scaleY) * image.w * 0.18)
  for (let y = 0; y < image.h; y++) {
    const fromBottom = (image.h - 1 - y) / span
    if (fromBottom > scaleY) continue
    const sy = image.h - 1 - Math.round((fromBottom / scaleY) * span)
    const ox = Math.round(lean * (1 - fromBottom))
    for (let x = 0; x < image.w; x++) {
      const sx = x - ox
      if (sy < 0 || sy >= image.h || sx < 0 || sx >= image.w) continue
      const s = sy * image.w + sx
      if (!image.mask[s]) continue
      const d = y * image.w + x
      mask[d] = 1
      rgb.set(image.rgb.subarray(s * 3, s * 3 + 3), d * 3)
    }
  }
  return { rgb, mask, w: image.w, h: image.h }
}

function deathOf(image) {
  return [image, fall(image, 0.82), fall(image, 0.55), fall(image, 0.32)]
}

export function sheetRow(picture, pose, now) {
  // walk 0 is an idle-only sheet (a merchant). A missing walk still means the
  // whole strip, which is what a walk-only picture stores on frames.
  const walk = Number.isInteger(picture.walk) ? picture.walk : (picture.frames || 0)
  const attack = picture.attack || 0
  const death = picture.death || 0
  if (pose.dead) {
    const started = Number.isFinite(pose.deadAt) ? pose.deadAt : now
    const index = Math.min(Math.max(death - 1, 0), Math.floor(Math.max(0, now - started) / 160))
    return walk + attack + index
  }
  if (pose.attackAt && now - pose.attackAt < attack * 140) {
    const index = Math.min(attack - 1, Math.floor((now - pose.attackAt) / 140))
    return walk + index
  }
  if (pose.moving && walk) return Math.floor(now / 160) % walk
  // A graze has no idle row. It loops the attack rows (the deer's head-down clip).
  if (pose.graze && attack) {
    const spun = Math.floor(now / 140) % attack
    return walk + ((spun % attack) + attack) % attack
  }
  if (picture.idle) return walk + attack + death + (Math.floor(now / 320) % picture.idle)
  return 0
}

// A flier (the bat) hangs `lift` world units above the ground while it
// lives. Its death cells keep the body on the sheet foot line (the build
// anchors each death frame on its own lowest pixel), so the fall is this
// lift: frame 0 still hovers, then it drops faster and faster (t squared)
// and lands as the last death frame starts. No death row: it is gone.
export function flierLift(lift, pose, now, deathFrames) {
  if (!lift) return 0
  if (!pose || !pose.dead) return lift
  if (!deathFrames) return 0
  const started = Number.isFinite(pose.deadAt) ? pose.deadAt : now
  const fall = Math.max(1, deathFrames - 2) * 160
  const t = Math.min(1, Math.max(0, (now - started - 160) / fall))
  return lift * (1 - t * t)
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
export function buildCard(front, kind, height = spriteHeight) {
  const views = directionsOf(front, kind)
  const cellW = front.w
  const cellH = front.h
  const atlasW = cellW * spriteDirections
  const atlasH = cellH * spriteFrames
  const atlas = new Uint8Array(atlasW * atlasH * 4)
  const frames = []
  for (let dir = 0; dir < views.length; dir++) {
    const cycle = [...walkOf(views[dir]), ...attackOf(views[dir]), ...deathOf(views[dir])]
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
  const worldH = height
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
    frames: spriteFrames,
    walk: spriteWalk,
    attack: spriteAttack,
    death: spriteDeath
  }
  const parts = /** @type {any} */ ([part])
  parts.marks = MARKS[kind].slice()
  parts.voxelCount = opaque
  parts.bounds = { w: worldW, h: worldH, d: depth }
  return parts
}


// Column 0 faces the camera. viewYaw is atan2(dx, dz) toward the camera and
// facing is atan2(dz, dx) of the heading, so a hero faces the camera when
// facing = PI/2 - viewYaw. Columns then turn S, SW, W, NW, N, NE, E, SE:
// column 2 faces screen-left and column 6 faces screen-right.
export function pictureColumn(viewYaw, facing) {
  const turn = Math.PI * 2
  let rel = viewYaw + facing - Math.PI / 2
  rel = ((rel % turn) + turn) % turn
  return Math.round(rel / (Math.PI / 4)) % spriteDirections
}

export function cellOffset(column, frame, directions, frames) {
  if (!directions || !frames) throw new Error("cell offset")
  return {
    x: column / directions,
    y: 1 - (frame + 1) / frames,
    repeatX: 1 / directions,
    repeatY: 1 / frames
  }
}
