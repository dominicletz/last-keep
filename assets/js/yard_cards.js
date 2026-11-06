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
