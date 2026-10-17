import { engineerVoxels, farmerVoxels, mageVoxels, scoutVoxels, warriorVoxels } from "../models/figures.js"

const HEROES = ["warrior", "mage", "scout", "farmer", "engineer"]

export function heroKinds() {
  return HEROES.slice()
}

export function heroParts(kind) {
  const source = partsFor(kind)
  const parts = source.map((part) => ({ ...part }))
  parts.voxelCount = source.voxelCount
  return parts
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
  if (kind === "warrior") return warriorVoxels()
  if (kind === "mage") return mageVoxels()
  if (kind === "scout") return scoutVoxels()
  if (kind === "engineer") return engineerVoxels()
  return farmerVoxels()
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
