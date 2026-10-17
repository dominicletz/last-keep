const SKIN = 0xd99b64
const STEEL = 0xd8cfc3
const ARMOR = 0xb5afaa
const DEEP = 0x142a48
const FOREST = 0x374a26
const JERKIN = 0x472a17
const WOOD = 0x8e755b
const DUSK = 0x5d505b
const GEM = 0x23d9f3
const STRAW = 0xe5b268
const DENIM = 0x3a4a60
const CLOTH = 0xe6ccad
const SHIELD = 0x38516f
const LEATHER = 0x261e0e
const PALISADE = 0x795237
const GOLD = 0xd99e66

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
      box("boot", 6, 4, 8, -4, 2, 1, LEATHER),
      box("boot", 6, 4, 8, 4, 2, 1, LEATHER),
      box("leg", 6, 10, 7, -4, 9, 0, ARMOR),
      box("leg", 6, 10, 7, 4, 9, 0, ARMOR),
      box("torso", 14, 14, 9, 0, 20, 0, ARMOR),
      box("shoulders", 26, 6, 12, 0, 28, 0, ARMOR, true),
      box("pauldron", 8, 6, 8, -12, 30, 0, ARMOR),
      box("pauldron", 8, 6, 8, 12, 30, 0, ARMOR),
      box("head", 7, 7, 7, 0, 35, 1, SKIN),
      box("helm", 9, 7, 9, 0, 41, 1, ARMOR),
      box("crest", 3, 6, 8, 0, 47, 0, ARMOR),
      box("cape", 10, 22, 3, 0, 22, -6, DUSK),
      box("shield", 4, 22, 16, -16, 20, 3, SHIELD, true),
      box("cross", 2, 12, 2, -16, 21, 11, GOLD),
      box("bar", 2, 2, 8, -16, 21, 11, GOLD),
      box("sword", 3, 26, 3, 14, 22, 2, STEEL),
      box("guard", 8, 2, 2, 14, 16, 2, STEEL)
    ]
  }
  if (kind === "mage") {
    return [
      box("hem", 20, 6, 14, 0, 3, 0, DEEP),
      box("robe", 12, 28, 9, 0, 18, 0, DEEP, true),
      box("trim", 14, 3, 4, 0, 16, 5, GOLD),
      box("hood", 10, 10, 10, 0, 34, 1, DEEP),
      box("head", 6, 6, 6, 0, 34, 3, SKIN),
      box("brim", 16, 2, 16, 0, 40, 0, DEEP),
      cone("hat", 10, 18, 10, 0, 50, 0, DEEP, true),
      box("staff", 2, 44, 2, 12, 22, 2, WOOD, true),
      box("gem", 5, 6, 5, 12, 46, 2, GEM)
    ]
  }
  if (kind === "scout") {
    return [
      box("boot", 5, 4, 6, -3, 2, 1, LEATHER),
      box("boot", 5, 4, 6, 3, 2, 1, LEATHER),
      box("legs", 8, 12, 6, 0, 10, 0, FOREST),
      box("cloak", 8, 20, 4, 0, 22, -3, FOREST),
      box("head", 6, 6, 6, 0, 30, 1, SKIN),
      box("hood", 11, 14, 11, 0, 36, 1, FOREST, true),
      box("bow", 3, 28, 6, 9, 20, 2, WOOD, true),
      box("string", 1, 24, 1, 11, 20, 2, STEEL),
      box("quiver", 4, 14, 4, -6, 22, -4, PALISADE)
    ]
  }
  if (kind === "engineer") {
    return [
      box("boot", 6, 4, 8, -4, 2, 1, LEATHER),
      box("boot", 6, 4, 8, 4, 2, 1, LEATHER),
      box("legs", 12, 10, 8, 0, 9, 0, JERKIN),
      box("torso", 13, 12, 8, 0, 19, 0, JERKIN),
      box("apron", 14, 16, 3, 0, 16, 5, JERKIN, true),
      box("head", 7, 7, 7, 0, 30, 1, SKIN),
      box("cap", 9, 5, 9, 0, 36, 0, LEATHER),
      box("goggles", 10, 3, 3, 0, 31, 5, STEEL),
      box("handle", 3, 16, 3, 13, 16, 2, WOOD),
      box("hammer", 14, 5, 5, 16, 24, 2, STEEL, true),
      box("log", 16, 4, 4, -2, 24, -7, WOOD),
      box("log", 14, 4, 4, 0, 28, -7, WOOD)
    ]
  }
  return [
    box("boot", 6, 4, 8, -4, 2, 1, LEATHER),
    box("boot", 6, 4, 8, 4, 2, 1, LEATHER),
    box("legs", 12, 12, 8, 0, 10, 0, DENIM),
    box("torso", 13, 12, 8, 0, 20, 0, CLOTH),
    box("strap", 12, 10, 3, 0, 18, 5, DENIM),
    box("head", 7, 7, 7, 0, 30, 1, SKIN),
    box("brim", 48, 3, 32, 0, 36, 0, STRAW, true),
    box("crown", 12, 6, 12, 0, 40, 0, STRAW),
    box("fork", 3, 36, 3, 14, 20, 2, WOOD, true),
    box("tine", 2, 8, 2, 11, 36, 2, WOOD),
    box("tine", 2, 8, 2, 14, 38, 2, WOOD),
    box("tine", 2, 8, 2, 17, 36, 2, WOOD),
    box("sack", 12, 12, 8, -2, 22, -7, STRAW)
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
