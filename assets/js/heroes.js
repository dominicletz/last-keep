const SKIN = 0xf0d2b0
const STEEL = 0xd8d2c4
const WOOD = 0x6b4228

const HEROES = ["warrior", "mage", "scout", "farmer", "engineer"]

export function heroKinds() {
  return HEROES.slice()
}

export function heroParts(kind) {
  return partsFor(kind).map((part) => ({ ...part }))
}

export function heroSignature(kind) {
  const parts = heroParts(kind)
  return {
    kind,
    parts,
    marks: parts.filter((part) => part.mark).map((part) => part.name),
    bounds: boundsOf(parts)
  }
}

function partsFor(kind) {
  if (kind === "warrior") {
    return [
      box("boots", 14, 4, 10, 0, 2, 0, 0x3a342c),
      box("legs", 14, 8, 9, 0, 8, 0, 0x4a4038),
      box("torso", 16, 12, 10, 0, 18, 0, 0x8e99a6),
      box("shoulders", 30, 7, 14, 0, 25, 0, 0x6e7580, true),
      box("head", 8, 8, 8, 0, 33, 0, SKIN),
      box("helm", 10, 6, 10, 0, 40, 0, 0xb0b6be),
      box("shield", 5, 18, 14, -18, 18, 2, 0x8a3d2f, true),
      box("sword", 3, 22, 3, 16, 20, 0, STEEL)
    ]
  }
  if (kind === "mage") {
    return [
      box("hem", 22, 4, 16, 0, 2, 0, 0x1d3558),
      box("robe", 14, 24, 10, 0, 15, 0, 0x2c4f86, true),
      box("head", 7, 7, 7, 0, 30, 0, SKIN),
      box("brim", 18, 2, 18, 0, 34, 0, 0x1a2744),
      cone("hat", 12, 16, 12, 0, 43, 0, 0x1a2744, true),
      box("staff", 2, 36, 2, 14, 18, 0, WOOD, true),
      box("gem", 4, 4, 4, 14, 38, 0, 0x7ec8ff)
    ]
  }
  if (kind === "scout") {
    return [
      box("legs", 8, 10, 6, 0, 5, 0, 0x243628),
      box("cloak", 10, 16, 5, 0, 16, -2, 0x1c3a24),
      box("head", 7, 7, 7, 0, 26, 0, SKIN),
      box("hood", 12, 12, 12, 0, 33, 1, 0x14281c, true),
      box("bow", 3, 26, 8, 10, 18, 0, WOOD, true),
      box("quiver", 4, 12, 4, -6, 18, -3, 0x6b4228)
    ]
  }
  if (kind === "engineer") {
    return [
      box("boots", 12, 4, 10, 0, 2, 0, 0x3a3028),
      box("legs", 12, 8, 8, 0, 8, 0, 0x4a4038),
      box("torso", 14, 12, 9, 0, 17, 0, 0x8a5a32),
      box("apron", 16, 14, 4, 0, 14, 6, 0xc4a574, true),
      box("head", 8, 7, 8, 0, 28, 0, SKIN),
      box("goggles", 10, 3, 4, 0, 30, 4, 0xd8d2c4),
      box("hammer", 14, 5, 5, 16, 20, 0, STEEL, true),
      box("handle", 3, 16, 3, 12, 14, 0, WOOD),
      box("satchel", 8, 8, 7, -2, 14, -7, 0x5a4030)
    ]
  }
  return [
    box("legs", 12, 8, 8, 0, 4, 0, 0x5a6a32),
    box("torso", 14, 12, 9, 0, 14, 0, 0xc4a15a),
    box("head", 8, 7, 8, 0, 24, 0, SKIN),
      box("brim", 44, 3, 44, 0, 30, 0, 0xd6b25a, true),
    box("crown", 10, 6, 10, 0, 34, 0, 0xc6a04a),
    box("fork", 3, 30, 3, 14, 16, 2, WOOD, true)
  ]
}

function box(name, w, h, d, x, y, z, color, mark = false) {
  return { name, shape: "box", w, h, d, x, y, z, color, mark }
}

function cone(name, w, h, d, x, y, z, color, mark = false) {
  return { name, shape: "cone", w, h, d, x, y, z, color, mark }
}

function boundsOf(parts) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const part of parts) {
    minX = Math.min(minX, part.x - part.w / 2)
    maxX = Math.max(maxX, part.x + part.w / 2)
    minY = Math.min(minY, part.y - part.h / 2)
    maxY = Math.max(maxY, part.y + part.h / 2)
    minZ = Math.min(minZ, part.z - part.d / 2)
    maxZ = Math.max(maxZ, part.z + part.d / 2)
  }
  return {
    w: round(maxX - minX),
    h: round(maxY - minY),
    d: round(maxZ - minZ)
  }
}

function round(value) {
  return Math.round(value * 10) / 10
}
