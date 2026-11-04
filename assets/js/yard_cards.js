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

// The tree card's art: the pine sheet from script/hero_sprites.py pine build
// (assets/reference/pine/asset.json). One row of cells, one per variant: a is
// the full pine (110 px), b the slender one drawn at 0.85 (94 px). Each figure's
// lowest outline row is footRow, with transparent rows under it. Drawn at the
// hero texel (32 / 88 world units per px), like the monster sheets.
export const treeSheet = {
  url: "images/hd2d/pine-sheet.png",
  cell: [128, 120],
  footRow: 115,
  variants: ["a", "b"],
  texel: 32 / 88
}

// World size, sprite center and texture window of one pine variant.
export function treeCard(variant) {
  const index = treeSheet.variants.indexOf(variant)
  if (index < 0) throw new Error(`no pine variant ${variant}`)
  const [cw, ch] = treeSheet.cell
  const n = treeSheet.variants.length
  return {
    w: cw * treeSheet.texel,
    h: ch * treeSheet.texel,
    centerY: (ch - 1 - treeSheet.footRow) / ch,
    repeat: [1 / n, 1],
    offset: [index / n, 0]
  }
}

// The variant the i-th tree draws: they alternate so a row does not repeat.
export function treeVariant(i) {
  const n = treeSheet.variants.length
  return treeSheet.variants[((Math.trunc(i) % n) + n) % n]
}
