// World size of a concept card. Texel density is this size over the crop in
// assets/models/tiles.js. A card coarser than the hero texel fails the yard test.
export const yardCards = {
  house: { w: 56, h: 64, stand: true },
  field: { w: 46, h: 26, stand: false },
  wall: { w: 30, h: 40, stand: true },
  forge: { w: 48, h: 36, stand: true },
  trap: { w: 22, h: 20, stand: true },
  tower: { w: 28, h: 48, stand: true },
  mage_tower: { w: 26, h: 36, stand: true },
  tree: { w: 48, h: 40, stand: true, cut: true },
  scenery: { w: 18, h: 30, stand: true, cut: true }
}

// The masonry crop repeats this many times across one stone face. Density is
// the face's world size over (crop pixels × this repeat).
export const stoneRepeat = { x: 2, y: 4 }

// A building with no card of its own draws the card named here until its art
// exists. stone_wall (rules.ex building/1) had neither a card nor a model, so
// buildingMesh threw "no model for stone_wall" when one was built.
export const cardFallback = { stone_wall: "wall" }

// The yardCards key a building of this kind draws, or null when it is a model.
export function buildingCard(kind) {
  if (yardCards[kind]) return kind
  const other = cardFallback[kind]
  return other && yardCards[other] ? other : null
}

// Static art sheets from script/hero_sprites.py <name> build
// (assets/reference/<name>/asset.json, "type": "static"): one row of cells,
// one per variant, each figure's lowest outline row footRow (the cell height
// minus hero_sprites.STATIC_MARGIN 4, minus 1), drawn at the hero texel
// (32 / 88 world units per px) like the monster sheets.
function staticSheet(name, cell, variants) {
  return { url: `images/hd2d/${name}-sheet.png`, cell, footRow: cell[1] - 5, variants, texel: 32 / 88 }
}

export const staticSheets = {
  // a is the full pine (110 px), b the slender one drawn at 0.85 (94 px).
  pine: staticSheet("pine", [128, 120], ["a", "b"]),
  wall: staticSheet("wall", [128, 120], ["a"]),
  stone_wall: staticSheet("stone_wall", [144, 120], ["a"]),
  tower: staticSheet("tower", [112, 144], ["a"]),
  house: staticSheet("house", [176, 184], ["a"]),
  forge: staticSheet("forge", [152, 112], ["a"]),
  // a armed; b sprung (a squashed to 0.6). The game has no sprung state yet.
  trap: staticSheet("trap", [80, 64], ["a", "b"]),
  // Flora, scattered by flora.js: b and c are smaller cuts (sizes from scale).
  bush: staticSheet("bush", [80, 48], ["a", "b", "c"]),
  rock: staticSheet("rock", [88, 56], ["a", "b", "c"]),
  flowers: staticSheet("flowers", [64, 24], ["a", "b"]),
  grass_tufts: staticSheet("grass_tufts", [40, 24], ["a", "b", "c"]),
  // b (a lying log) is pending a retake: the sheet has only the stump.
  stump_log: staticSheet("stump_log", [80, 40], ["a"]),
  broadleaf: staticSheet("broadleaf", [136, 120], ["a", "b"])
}

// Static sheets that are scenery, not a building kind.
export const floraSheets = ["bush", "rock", "flowers", "grass_tufts", "stump_log", "broadleaf"]

// The tree card's art is the pine sheet.
export const treeSheet = staticSheets.pine

// The static sheet a building of this kind draws, or null (its old card or model).
export function buildingSheet(kind) {
  return staticSheets[kind] && kind !== "pine" && !floraSheets.includes(kind) ? kind : null
}

// World size, sprite center and texture window of one variant of a sheet.
export function sheetCard(name, variant) {
  const sheet = staticSheets[name]
  if (!sheet) throw new Error(`no static sheet ${name}`)
  const index = sheet.variants.indexOf(variant)
  if (index < 0) throw new Error(`no ${name} variant ${variant}`)
  const [cw, ch] = sheet.cell
  const n = sheet.variants.length
  return {
    w: cw * sheet.texel,
    h: ch * sheet.texel,
    centerY: (ch - 1 - sheet.footRow) / ch,
    repeat: [1 / n, 1],
    offset: [index / n, 0]
  }
}

export function treeCard(variant) {
  if (!treeSheet.variants.includes(variant)) throw new Error(`no pine variant ${variant}`)
  return sheetCard("pine", variant)
}

// The variant the i-th tree draws: they alternate so a row does not repeat.
export function treeVariant(i) {
  const n = treeSheet.variants.length
  return treeSheet.variants[((Math.trunc(i) % n) + n) % n]
}
