import { heroParts } from "../js/heroes.js"
import { sceneryForest } from "../js/scenery.js"

// A mesh may extend this many times past the gameplay radius. The farmer brim
// is wider than the body (22 against 14) and still fits. A mesh at 3x does not.
export const fitSlack = 2

// Same-family silhouettes at or above this IoU fail. They have to read apart.
export const iouLimit = 0.85

export const conceptSheets = ["lk_heroes.jpg", "lk_theme.jpg", "lk_monsters.jpg"]

export const yardProps = ["keep", "tree", "scenery"]

const HERO_RADIUS = 14
const TREE_RADIUS = 16

function box(name, w, h, d, x, y, z, color) {
  return { name, shape: "box", w, h, d, x, y, z, color }
}

function cone(name, w, h, d, x, y, z, color, segments = 4) {
  return { name, shape: "cone", w, h, d, x, y, z, color, segments }
}

function prism(name, rt, rb, h, segments, x, y, z, color) {
  return { name, shape: "prism", rt, rb, h, segments, x, y, z, color }
}

function entry(id, family, collider, concept, minArea, parts) {
  return { id, family, collider, concept, minArea, parts }
}

function hero(id, minArea) {
  return entry(id, "hero", { r: HERO_RADIUS }, { sheet: "lk_heroes.jpg", figure: id }, minArea, null)
}

function monster(id, r, minArea, parts) {
  return entry(id, "monster", { r }, { sheet: "lk_monsters.jpg", figure: id }, minArea, parts)
}

function building(id, r, minArea, parts, figure = id) {
  return entry(id, "building", { r }, { sheet: "lk_theme.jpg", figure }, minArea, parts)
}

// minArea is the recorded silhouette floor at game zoom (about 80% of the
// measured dusk mask). A shrink below it fails. It also has to stay at least
// half of whatever the current render measures.
const REGISTRY = [
  hero("warrior", 499),
  hero("mage", 418),
  hero("scout", 293),
  hero("farmer", 718),
  hero("engineer", 297),
  monster("goblin", 16, 304, [
    box("body", 20, 14, 14, 0, 9, 0, 0xff3a22),
    box("head", 12, 10, 12, 0, 20, 0, 0xff3a22),
    box("ear", 10, 4, 4, -14, 22, 0, 0xff3a22),
    box("ear", 10, 4, 4, 14, 22, 0, 0xff3a22)
  ]),
  monster("skeleton", 13, 129, [
    box("ribs", 8, 20, 5, 0, 14, 0, 0xe8e0d0),
    box("skull", 6, 6, 6, 0, 28, 0, 0xe8e0d0),
    box("arm", 2, 16, 2, -6, 16, 0, 0xe8e0d0),
    box("arm", 2, 16, 2, 6, 16, 0, 0xe8e0d0)
  ]),
  monster("wolf", 13, 199, [
    box("body", 26, 8, 10, 0, 7, 0, 0x2c3344),
    box("head", 8, 8, 8, 14, 12, 0, 0x2c3344),
    box("snout", 6, 4, 4, 20, 11, 0, 0x2c3344),
    box("tail", 10, 3, 3, -16, 10, 0, 0x2c3344)
  ]),
  monster("troll", 22, 836, [
    box("body", 32, 30, 22, 0, 18, 0, 0x2f6a32),
    box("head", 16, 14, 16, 0, 40, 0, 0x2f6a32),
    box("arm", 10, 22, 10, -20, 24, 0, 0x2f6a32),
    box("arm", 10, 22, 10, 20, 24, 0, 0x2f6a32)
  ]),
  monster("boss", 34, 1066, [
    box("body", 36, 40, 24, 0, 26, 0, 0x6a3a8a),
    box("head", 16, 14, 16, 0, 52, 0, 0x6a3a8a),
    cone("horn", 8, 20, 8, -18, 66, 0, 0x6a3a8a),
    cone("horn", 8, 20, 8, 18, 66, 0, 0x6a3a8a)
  ]),
  building("wall", 16, 369, [box("wall", 30, 22, 12, 0, 11, 0, 0x6b4228)]),
  building("tower", 16, 615, [
    box("tower", 22, 36, 22, 0, 18, 0, 0x6e675c),
    box("flame", 6, 6, 6, 0, 40, 0, 0xffb15a)
  ]),
  building("trap", 15, 212, [box("trap", 22, 6, 22, 0, 3, 0, 0x8a8174)]),
  building("field", 16, 278, [box("field", 30, 2, 30, 0, 1, 0, 0xc6b04a)]),
  building("forge", 18, 612, [box("forge", 28, 24, 28, 0, 12, 0, 0xa84828)]),
  building("mage_tower", 18, 806, [box("spire", 26, 40, 26, 0, 20, 0, 0x3a4f86)], "mage tower"),
  entry("keep", "prop", { r: 54 }, { sheet: "lk_theme.jpg", figure: "keep" }, 3217, [
    box("base", 70, 28, 70, 0, 14, 0, 0x6e675c),
    box("tower", 28, 70, 28, 0, 48, 0, 0x7d756a),
    cone("roof", 44, 28, 44, 0, 92, 0, 0x8a3d2f),
    box("door", 16, 18, 4, 0, 10, 36, 0x3a2418),
    box("window", 6, 8, 4, 0, 58, 14, 0xffb15a)
  ]),
  entry("tree", "prop", { r: TREE_RADIUS }, { sheet: "lk_theme.jpg", figure: "harvestable tree" }, 244, [
    prism("trunk", 3, 4, 12, 5, 0, 6, 0, 0x5a3a22),
    cone("crown", 28, 28, 28, 0, 24, 0, 0x2f6a3c, 5)
  ]),
  entry("scenery", "prop", { r: sceneryForest().radiusBottom }, { sheet: "lk_theme.jpg", figure: "scenery trunk" }, 97, null)
]

export function models() {
  const look = sceneryForest()
  return REGISTRY.map((model) => {
    if (model.family === "hero") return { ...model, parts: heroParts(model.id) }
    if (model.id === "scenery") {
      return {
        ...model,
        parts: [
          prism("trunk", look.radiusTop, look.radiusBottom, look.height, look.segments, 0, look.height / 2, 0, look.trunk)
        ]
      }
    }
    return { ...model, parts: model.parts.map((part) => ({ ...part })) }
  })
}

export function modelParts(id) {
  const model = models().find((row) => row.id === id)
  if (!model) throw new Error(`no model for ${id}`)
  return model.parts
}

export function horizontalRadius(parts) {
  let max = 0
  for (const part of parts) {
    max = Math.max(max, Math.abs(part.x) + radialX(part), Math.abs(part.z) + radialZ(part))
  }
  return max
}

function radialX(part) {
  if (part.shape === "box") return part.w / 2
  if (part.shape === "cone") return part.w / 2
  return Math.max(part.rt || 0, part.rb || 0)
}

function radialZ(part) {
  if (part.shape === "box") return part.d / 2
  return radialX(part)
}

export function modelBounds(id) {
  const parts = modelParts(id)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const part of parts) {
    const hx = radialX(part)
    const hy = part.h / 2
    const hz = radialZ(part)
    minX = Math.min(minX, part.x - hx)
    maxX = Math.max(maxX, part.x + hx)
    minY = Math.min(minY, part.y - hy)
    maxY = Math.max(maxY, part.y + hy)
    minZ = Math.min(minZ, part.z - hz)
    maxZ = Math.max(maxZ, part.z + hz)
  }
  const pad = 1.08
  return {
    w: (maxX - minX) * pad,
    h: (maxY - minY) * pad,
    d: (maxZ - minZ) * pad,
    y: (minY + maxY) / 2,
    height: maxY,
    radius: Math.max(maxX, -minX, maxZ, -minZ)
  }
}

export function hexOf(color) {
  return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`
}

export function rulesFrom(source) {
  const heroes = atoms(source, /@heroes\s+\[([^\]]+)\]/)
  const builds = atoms(source, /@builds\s+\[([^\]]+)\]/)
  const monsters = [...source.matchAll(/def monster\(:([a-z_]+)\)/g)].map((match) => match[1])
  if (heroes.length === 0 || builds.length === 0 || monsters.length === 0) {
    throw new Error("rules.ex did not list heroes, monsters, and builds")
  }
  return { heroes, builds, monsters }
}

function atoms(source, pattern) {
  const match = source.match(pattern)
  if (!match) return []
  return [...match[1].matchAll(/:([a-z_]+)/g)].map((item) => item[1])
}

export function styleTables(markdown) {
  const tokens = new Map()
  const kinds = new Map()
  for (const line of markdown.split("\n")) {
    const token = line.match(/^\| ([a-z][a-z0-9-]*) \| #([0-9a-f]{6}) \|/)
    if (token && token[1] !== "token") tokens.set(token[2], token[1])
    const kind = line.match(/^\| ([a-z][a-z0-9_]*) \| (hero|monster|building|prop) \| (lk_(?:heroes|theme|monsters)\.jpg) \| ([^|]+) \|/)
    if (kind && kind[1] !== "id") {
      kinds.set(kind[1], { family: kind[2], sheet: kind[3], figure: kind[4].trim() })
    }
  }
  return { tokens, kinds }
}

export function coverageProblems(listed, rules) {
  const problems = []
  const ids = listed.map((model) => model.id)
  if (new Set(ids).size !== ids.length) problems.push("duplicate model id")
  const expected = [...rules.heroes, ...rules.monsters, ...rules.builds, ...yardProps]
  for (const id of expected) {
    if (!ids.includes(id)) problems.push(`kind ${id} has no model`)
  }
  const known = new Set(expected)
  for (const id of ids) {
    if (!known.has(id)) problems.push(`model ${id} has no kind`)
  }
  for (const id of rules.heroes) {
    const model = listed.find((row) => row.id === id)
    if (model && model.family !== "hero") problems.push(`${id} is not a hero model`)
  }
  for (const id of rules.monsters) {
    const model = listed.find((row) => row.id === id)
    if (model && model.family !== "monster") problems.push(`${id} is not a monster model`)
  }
  for (const id of rules.builds) {
    const model = listed.find((row) => row.id === id)
    if (model && model.family !== "building") problems.push(`${id} is not a building model`)
  }
  return problems
}

export function paletteProblems(listed, tokens) {
  const problems = []
  for (const model of listed) {
    for (const part of model.parts) {
      const hex = hexOf(part.color).slice(1)
      if (!tokens.has(hex)) problems.push(`${model.id} ${part.name} uses #${hex}, which is not a STYLE.md palette token`)
    }
  }
  return problems
}

export function styleProblems(listed, kinds) {
  const problems = []
  for (const model of listed) {
    const row = kinds.get(model.id)
    if (!row) {
      problems.push(`${model.id} has no STYLE.md entry`)
      continue
    }
    if (row.family !== model.family) problems.push(`${model.id} family disagrees with STYLE.md`)
    if (row.sheet !== model.concept.sheet || row.figure !== model.concept.figure) {
      problems.push(`${model.id} concept mapping disagrees with STYLE.md`)
    }
  }
  for (const id of kinds.keys()) {
    if (!listed.some((model) => model.id === id)) problems.push(`STYLE.md lists ${id}, which has no model`)
  }
  return problems
}

export function conceptProblems(listed) {
  const problems = []
  for (const model of listed) {
    const concept = model.concept
    if (!concept || !conceptSheets.includes(concept.sheet) || !String(concept.figure || "").trim()) {
      problems.push(`${model.id} has no concept mapping`)
    }
  }
  return problems
}

export function fitProblems(listed) {
  const problems = []
  for (const model of listed) {
    const radius = horizontalRadius(model.parts)
    const limit = model.collider.r * fitSlack
    if (!(model.collider.r > 0)) problems.push(`${model.id} has no collider`)
    if (radius > limit + 1e-6) {
      problems.push(`${model.id} extends ${radius.toFixed(2)} past collider ${model.collider.r} with fit slack ${fitSlack}`)
    }
  }
  return problems
}

export function radiusProblems(listed, rulesSource, simSource) {
  const problems = []
  const expect = (id, radius) => {
    const model = listed.find((row) => row.id === id)
    if (!model) return
    if (model.collider.r !== radius) problems.push(`${id} collider ${model.collider.r} does not match gameplay radius ${radius}`)
  }
  const hero = simSource.match(/type: :hero[\s\S]{0,400}?r: ([\d.]+)/)
  const keep = simSource.match(/keep: %\{[^}]*r: ([\d.]+)/)
  if (!hero || !keep) problems.push("sim.ex did not name the hero or keep radius")
  if (hero) expect("warrior", Number(hero[1]))
  for (const id of ["mage", "scout", "farmer", "engineer"]) {
    if (hero) expect(id, Number(hero[1]))
  }
  if (keep) expect("keep", Number(keep[1]))
  const treeRadii = [...simSource.matchAll(/type: :tree[\s\S]{0,240}?r: ([\d.]+)/g)].map((match) => Number(match[1]))
  if (treeRadii.length === 0 || treeRadii.some((radius) => radius !== treeRadii[0])) {
    problems.push("sim.ex tree radius is missing or not unique")
  } else {
    expect("tree", treeRadii[0])
  }
  for (const model of listed) {
    if (model.family !== "monster" && model.family !== "building") continue
    const pattern =
      model.family === "monster"
        ? new RegExp(`def monster\\(:${model.id}\\), do: %\\{[^}]*r: (\\d+)`)
        : new RegExp(`def building\\(:${model.id}\\), do: %\\{[^}]*r: (\\d+)`)
    const match = rulesSource.match(pattern)
    if (!match) problems.push(`rules.ex has no radius for ${model.id}`)
    else expect(model.id, Number(match[1]))
  }
  const look = sceneryForest()
  expect("scenery", look.radiusBottom)
  return problems
}
