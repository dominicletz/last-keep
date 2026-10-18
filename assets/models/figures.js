import { carve } from "./voxels.js"

const SKIN = 0xd99b64
const STEEL = 0xd8cfc3
const ARMOR = 0xb5afaa
const DUSK = 0x5d505b
const SHIELD = 0x38516f
const LEATHER = 0x261e0e
const GOLD = 0xd99e66
const GOBLIN = 0x676f3c
const TORCH = 0xf5751e
const WOOD = 0x8e755b
const BONE = 0x908b8a
const RIB = 0xb2ada6
const WOLF = 0x6e6767
const OGRE = 0x70724d
const HIDE = 0x4d433b
const RIDER = 0x4a464c
const HORN = 0x3a264d
const DEEP = 0x142a48
const GEM = 0x23d9f3
const FOREST = 0x374a26
const JERKIN = 0x472a17
const STRAW = 0xe5b268
const DENIM = 0x3a4a60
const CLOTH = 0xe6ccad

export function warriorVoxels() {
  return carve(1.97, ({ fill, put }) => {
    fill(-2, 0, -1, -1, 3, 1, "boot", LEATHER)
    fill(1, 0, -1, 2, 3, 1, "boot", LEATHER)
    fill(-2, 4, -1, -1, 8, 1, "leg", ARMOR)
    fill(1, 4, -1, 2, 8, 1, "leg", ARMOR)
    fill(-3, 9, -2, 3, 10, 2, "belt", LEATHER)
    fill(-3, 11, -2, 3, 15, 2, "torso", ARMOR)
    fill(-1, 12, 3, 1, 15, 3, "breast", STEEL)
    fill(-6, 14, -2, 6, 16, 2, "shoulders", ARMOR, true)
    fill(-8, 13, -2, -5, 16, 2, "pauldron", ARMOR)
    fill(5, 13, -2, 8, 16, 2, "pauldron", ARMOR)
    fill(-1, 17, 1, 1, 20, 3, "face", SKIN)
    fill(-1, 16, 3, 1, 17, 4, "beard", LEATHER)
    put(-1, 19, 4, "eye", LEATHER)
    put(1, 19, 4, "eye", LEATHER)
    fill(-2, 16, -2, 2, 21, 0, "helm", ARMOR)
    fill(-2, 16, -2, -2, 21, 3, "helm", ARMOR)
    fill(2, 16, -2, 2, 21, 3, "helm", ARMOR)
    fill(-1, 20, 1, 1, 22, 2, "helm", ARMOR)
    fill(0, 23, -1, 0, 26, 1, "crest", ARMOR)
    fill(-3, 11, -6, 3, 16, -3, "cape", DUSK)
    fill(-10, 6, 2, -5, 18, 3, "shield", SHIELD, true)
    fill(-8, 8, 4, -7, 16, 4, "cross", GOLD)
    fill(-10, 11, 4, -5, 13, 4, "bar", GOLD)
    fill(5, 4, 3, 6, 16, 4, "sword", STEEL)
    fill(4, 8, 2, 8, 9, 5, "guard", GOLD)
    fill(5, 2, 3, 6, 3, 4, "grip", LEATHER)
  })
}

export function goblinVoxels() {
  return carve(2.04, ({ fill, put }) => {
    fill(-1, 0, -1, 0, 2, 1, "boot", LEATHER)
    fill(1, 0, -1, 2, 2, 1, "boot", LEATHER)
    fill(-1, 3, -1, 0, 5, 1, "leg", GOBLIN)
    fill(1, 3, -1, 2, 5, 1, "leg", GOBLIN)
    fill(-2, 6, -1, 2, 11, 2, "body", GOBLIN)
    fill(-2, 7, 3, 2, 8, 3, "belt", WOOD)
    fill(-1, 4, 2, 1, 7, 3, "cloth", HIDE)
    fill(-2, 12, -1, 2, 16, 2, "head", GOBLIN)
    fill(-2, 15, 3, 2, 16, 3, "brow", GOBLIN)
    fill(-1, 12, 3, 1, 14, 4, "snout", GOBLIN)
    fill(-1, 13, 5, 1, 13, 5, "teeth", BONE)
    put(-1, 15, 3, "eye", TORCH)
    put(1, 15, 3, "eye", TORCH)
    put(-1, 14, 3, "eye", TORCH)
    put(1, 14, 3, "eye", TORCH)
    fill(-5, 14, 0, -3, 16, 1, "ear", GOBLIN)
    fill(3, 14, 0, 5, 16, 1, "ear", GOBLIN)
    fill(-6, 15, 0, -5, 17, 0, "ear", GOBLIN)
    fill(5, 15, 0, 6, 17, 0, "ear", GOBLIN)
    fill(-4, 8, 1, -3, 11, 2, "arm", GOBLIN)
    fill(4, 2, 0, 7, 18, 3, "spear", WOOD)
    fill(5, 17, 0, 8, 21, 3, "head", STEEL)
    fill(4, 17, 1, 5, 19, 2, "tip", STEEL)
    fill(4, 20, 1, 5, 23, 2, "flame", TORCH)
  })
}

export function mageVoxels() {
  return carve(1.7, ({ fill, put }) => {
    fill(-3, 0, -2, 3, 4, 2, "hem", DEEP)
    fill(-2, 5, -2, 2, 16, 2, "robe", DEEP, true)
    fill(-3, 8, 3, 3, 9, 3, "trim", GOLD)
    fill(-2, 17, -2, 2, 21, 2, "hood", DEEP)
    fill(-1, 18, 3, 1, 20, 3, "head", SKIN)
    put(-1, 19, 3, "eye", LEATHER)
    put(1, 19, 3, "eye", LEATHER)
    fill(-3, 22, -3, 3, 22, 3, "brim", DEEP)
    fill(-2, 23, -2, 2, 31, 2, "hat", DEEP, true)
    fill(4, 0, 0, 5, 22, 1, "staff", WOOD, true)
    fill(4, 23, 0, 5, 26, 1, "gem", GEM)
  })
}

export function scoutVoxels() {
  return carve(1.74, ({ fill, put }) => {
    fill(-2, 0, -1, -1, 2, 1, "boot", LEATHER)
    fill(1, 0, -1, 2, 2, 1, "boot", LEATHER)
    fill(-2, 3, -1, 2, 8, 1, "legs", FOREST)
    fill(-2, 6, -4, 2, 16, -2, "cloak", FOREST)
    fill(-2, 9, -1, 2, 15, 2, "torso", FOREST)
    fill(-4, 16, -2, 4, 21, 2, "hood", FOREST, true)
    fill(-1, 17, 3, 1, 19, 3, "head", SKIN)
    put(0, 18, 3, "eye", LEATHER)
    fill(6, 6, 0, 7, 18, 2, "bow", WOOD, true)
    fill(8, 7, 1, 8, 17, 1, "string", STEEL)
    fill(-5, 10, -4, -4, 15, -3, "quiver", WOOD)
  })
}

export function farmerVoxels() {
  return carve(2.08, ({ fill, put }) => {
    fill(-2, 0, -1, -1, 2, 1, "boot", LEATHER)
    fill(1, 0, -1, 2, 2, 1, "boot", LEATHER)
    fill(-2, 3, -1, 2, 9, 1, "legs", DENIM)
    fill(-3, 10, -2, 3, 16, 2, "torso", CLOTH)
    fill(-2, 10, 3, 2, 15, 3, "strap", DENIM)
    fill(-1, 17, -1, 1, 20, 2, "head", SKIN)
    put(-1, 19, 2, "eye", LEATHER)
    put(1, 19, 2, "eye", LEATHER)
    fill(0, 18, 3, 0, 18, 3, "beard", LEATHER)
    fill(-12, 21, -5, 12, 22, 5, "brim", STRAW, true)
    fill(-2, 23, -2, 2, 25, 2, "crown", STRAW)
    fill(5, 2, 0, 6, 20, 1, "fork", WOOD, true)
    fill(4, 21, 0, 4, 24, 0, "tine", WOOD)
    fill(5, 22, 0, 5, 25, 0, "tine", WOOD)
    fill(6, 21, 0, 6, 24, 0, "tine", WOOD)
    fill(-3, 11, -5, 1, 16, -3, "sack", STRAW)
  })
}

export function engineerVoxels() {
  return carve(1.83, ({ fill, put }) => {
    fill(-2, 0, -1, -1, 2, 1, "boot", LEATHER)
    fill(1, 0, -1, 2, 2, 1, "boot", LEATHER)
    fill(-2, 3, -1, 2, 9, 1, "legs", JERKIN)
    fill(-3, 10, -2, 3, 16, 2, "torso", JERKIN)
    fill(-3, 9, 3, 3, 16, 4, "apron", JERKIN, true)
    fill(-1, 17, -1, 1, 20, 2, "head", SKIN)
    put(-1, 19, 3, "eye", LEATHER)
    put(1, 19, 3, "eye", LEATHER)
    fill(-2, 21, -2, 2, 23, 2, "cap", LEATHER)
    fill(-2, 19, 3, 2, 19, 3, "goggles", STEEL)
    fill(5, 6, 0, 6, 16, 1, "handle", WOOD)
    fill(3, 16, -1, 10, 19, 1, "hammer", STEEL, true)
    fill(-4, 17, -4, 2, 18, -3, "log", WOOD)
    fill(-3, 19, -4, 2, 20, -3, "log", WOOD)
  })
}

export function skeletonVoxels() {
  return carve(2.15, ({ fill, put }) => {
    fill(-1, 0, 0, 0, 2, 1, "boot", BONE)
    fill(1, 0, 0, 2, 2, 1, "boot", BONE)
    fill(-1, 3, 0, 0, 8, 0, "leg", BONE)
    fill(1, 3, 0, 2, 8, 0, "leg", BONE)
    fill(-2, 9, -1, 2, 10, 1, "hip", BONE)
    fill(-4, 11, 2, 4, 12, 2, "ribs", RIB)
    fill(-4, 17, 2, 4, 18, 2, "ribs", RIB)
    fill(-4, 23, 2, 4, 24, 2, "ribs", RIB)
    fill(0, 11, 0, 0, 22, 0, "spine", BONE)
    fill(-5, 14, 0, -4, 20, 0, "arm", BONE)
    fill(4, 14, 0, 5, 20, 0, "arm", BONE)
    fill(5, 8, 1, 6, 18, 1, "sword", STEEL)
    fill(-2, 26, -1, 2, 29, 2, "skull", BONE)
    put(-1, 28, 2, "eye", TORCH)
    put(1, 28, 2, "eye", TORCH)
  })
}

export function wolfVoxels() {
  return carve(1.55, ({ fill, put }) => {
    fill(-5, 4, -2, 4, 8, 2, "body", WOLF)
    fill(-10, 6, -1, -6, 8, 1, "tail", WOLF)
    fill(4, 6, -2, 8, 10, 2, "head", WOLF)
    fill(8, 6, -1, 11, 8, 1, "snout", WOLF)
    fill(-4, 0, -2, -2, 4, -1, "leg", WOLF)
    fill(-4, 0, 1, -2, 4, 2, "leg", WOLF)
    fill(1, 0, -2, 3, 4, -1, "leg", WOLF)
    fill(1, 0, 1, 3, 4, 2, "leg", WOLF)
    put(6, 9, 2, "eye", TORCH)
    put(7, 9, 2, "eye", TORCH)
    fill(5, 11, -2, 6, 13, -1, "ear", WOLF)
    fill(5, 11, 1, 6, 13, 2, "ear", WOLF)
    fill(-2, 8, -3, 2, 10, -2, "fur", HIDE)
    fill(0, 8, 2, 3, 10, 3, "fur", HIDE)
  })
}

export function ogreVoxels() {
  return carve(2.48, ({ fill, put }) => {
    fill(-3, 0, -2, -1, 4, 1, "boot", LEATHER)
    fill(1, 0, -2, 3, 4, 1, "boot", LEATHER)
    fill(-5, 5, -3, 5, 14, 3, "body", OGRE)
    fill(-3, 8, 4, 3, 12, 6, "belly", OGRE)
    fill(-3, 15, -2, 3, 20, 3, "head", OGRE)
    fill(-6, 17, 0, -4, 20, 1, "ear", OGRE)
    fill(4, 17, 0, 6, 20, 1, "ear", OGRE)
    put(-1, 18, 4, "eye", TORCH)
    put(2, 18, 4, "eye", TORCH)
    fill(-1, 16, 4, 2, 17, 5, "teeth", BONE)
    fill(-3, 9, 3, 2, 11, 4, "belt", WOOD)
    fill(-8, 8, -1, -6, 14, 2, "arm", OGRE)
    fill(6, 7, -1, 8, 14, 2, "arm", OGRE)
    fill(7, 2, -2, 10, 8, 2, "club", WOOD)
  })
}

export function batVoxels() {
  return carve(1.76, ({ fill, put }) => {
    fill(-1, 6, -1, 1, 9, 1, "body", HIDE)
    fill(1, 7, -1, 3, 10, 1, "head", HIDE)
    fill(1, 11, -1, 2, 13, 0, "ear", HIDE)
    fill(3, 11, 0, 4, 13, 1, "ear", HIDE)
    fill(-4, 8, -1, -2, 9, 1, "wing", BONE)
    fill(-8, 7, -1, -5, 8, 1, "wing", BONE)
    fill(-12, 6, -1, -9, 7, 1, "wing", BONE)
    fill(-9, 8, -1, -6, 8, 1, "wing", BONE)
    fill(4, 8, -1, 6, 9, 1, "wing", BONE)
    fill(7, 7, -1, 10, 8, 1, "wing", BONE)
    fill(11, 6, -1, 14, 7, 1, "wing", BONE)
    fill(8, 8, -1, 11, 8, 1, "wing", BONE)
    put(2, 9, 2, "eye", TORCH)
    put(3, 9, 2, "eye", TORCH)
  })
}

export function riderVoxels() {
  return carve(4, ({ fill, put }) => {
    fill(-8, 0, -3, -6, 4, -2, "hoof", RIDER)
    fill(-8, 0, 1, -6, 4, 2, "hoof", RIDER)
    fill(2, 0, -3, 4, 4, -2, "hoof", RIDER)
    fill(2, 0, 1, 4, 4, 2, "hoof", RIDER)
    fill(-7, 5, -2, 5, 10, 2, "horse", RIDER)
    fill(5, 9, -1, 8, 14, 2, "neck", RIDER)
    fill(8, 12, -1, 12, 16, 2, "head", RIDER)
    fill(12, 13, 0, 15, 15, 1, "muzzle", RIDER)
    fill(8, 16, -1, 9, 18, 0, "ear", RIDER)
    put(10, 15, 2, "eye", TORCH)
    fill(-11, 7, -1, -8, 10, 1, "tail", HORN)
    fill(-2, 11, -1, 1, 16, 2, "body", STEEL)
    fill(-2, 17, -1, 2, 20, 2, "helm", STEEL)
    fill(-1, 21, 0, 1, 25, 1, "horn", HORN)
    put(0, 18, 3, "eye", TORCH)
    fill(-4, 12, -6, 2, 16, -3, "cape", HORN)
    fill(3, 13, 3, 4, 22, 4, "axe", STEEL)
  })
}
