import { heroParts } from "../js/heroes.js"
import { sceneryForest } from "../js/scenery.js"

// A mesh may extend this many times past the gameplay radius. The farmer brim
// is wider than the body (22 against 14) and still fits. A mesh at 3x does not.
export const fitSlack = 2

// Same-family silhouettes at or above this IoU fail. They have to read apart.
export const iouLimit = 0.85

export const conceptSheets = ["heroes.jpg", "monsters.jpg", "theme.jpg"]

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

function crop(x, y, w, h) {
  return { x, y, w, h }
}

function hero(id, minArea, frame) {
  return entry(id, "hero", { r: HERO_RADIUS }, { sheet: "heroes.jpg", figure: id, crop: frame }, minArea, null)
}

function monster(id, r, minArea, frame, parts, figure = id) {
  return entry(id, "monster", { r }, { sheet: "monsters.jpg", figure, crop: frame }, minArea, parts)
}

function building(id, r, minArea, frame, parts, figure = id) {
  return entry(id, "building", { r }, { sheet: "theme.jpg", figure, crop: frame }, minArea, parts)
}

// minArea is the recorded silhouette floor at game zoom (about 80% of the
// measured dusk mask). A shrink below it fails. It also has to stay at least
// half of whatever the current render measures.
const REGISTRY = [
  hero("warrior", 499, crop(24, 158, 268, 412)),
  hero("mage", 418, crop(312, 124, 196, 448)),
  hero("scout", 293, crop(524, 100, 216, 480)),
  hero("farmer", 718, crop(752, 98, 250, 480)),
  hero("engineer", 297, crop(1016, 158, 224, 432)),
  monster("goblin", 16, 304, crop(16, 328, 236, 246), [
    box("body", 20, 14, 14, 0, 9, 0, 0x676f3c),
    box("head", 12, 10, 12, 0, 20, 0, 0x676f3c),
    box("ear", 10, 4, 4, -14, 22, 0, 0x676f3c),
    box("ear", 10, 4, 4, 14, 22, 0, 0x676f3c)
  ]),
  monster("skeleton", 13, 129, crop(260, 328, 260, 246), [
    box("ribs", 8, 20, 5, 0, 14, 0, 0x908b8a),
    box("skull", 6, 6, 6, 0, 28, 0, 0x908b8a),
    box("arm", 2, 16, 2, -6, 16, 0, 0x908b8a),
    box("arm", 2, 16, 2, 6, 16, 0, 0x908b8a)
  ]),
  monster("wolf", 13, 199, crop(760, 340, 270, 245), [
    box("body", 26, 8, 10, 0, 7, 0, 0x6e6767),
    box("head", 8, 8, 8, 14, 12, 0, 0x6e6767),
    box("snout", 6, 4, 4, 20, 11, 0, 0x6e6767),
    box("tail", 10, 3, 3, -16, 10, 0, 0x6e6767)
  ]),
  monster("troll", 22, 836, crop(524, 292, 226, 286), [
    box("body", 32, 30, 22, 0, 18, 0, 0x70724d),
    box("head", 16, 14, 16, 0, 40, 0, 0x70724d),
    box("arm", 10, 22, 10, -20, 24, 0, 0x70724d),
    box("arm", 10, 22, 10, 20, 24, 0, 0x70724d)
  ], "ogre"),
  monster("boss", 34, 1066, crop(1000, 70, 275, 520), [
    box("body", 36, 40, 24, 0, 26, 0, 0x4a464c),
    box("head", 16, 14, 16, 0, 52, 0, 0x4a464c),
    cone("horn", 8, 20, 8, -18, 66, 0, 0x3a264d),
    cone("horn", 8, 20, 8, 18, 66, 0, 0x3a264d)
  ], "dark rider"),
  building("wall", 16, 369, crop(160, 280, 250, 220), [box("wall", 30, 22, 12, 0, 11, 0, 0x795237)], "palisade"),
  building("tower", 16, 615, crop(590, 36, 120, 130), [
    box("tower", 22, 36, 22, 0, 18, 0, 0x554034),
    box("flame", 6, 6, 6, 0, 40, 0, 0xeea821)
  ], "stone tower"),
  building("trap", 15, 212, crop(520, 490, 100, 90), [box("trap", 22, 6, 22, 0, 3, 0, 0x4d433b)], "ground torch"),
  building("field", 16, 278, crop(740, 300, 250, 140), [box("field", 30, 2, 30, 0, 1, 0, 0x976122)], "wheat"),
  building("forge", 18, 612, crop(500, 190, 200, 150), [box("forge", 28, 24, 28, 0, 12, 0, 0xf5751e)], "lit house"),
  building("mage_tower", 18, 806, crop(470, 330, 160, 140), [box("spire", 26, 40, 26, 0, 20, 0, 0x3e6dab)], "spell light"),
  entry("keep", "prop", { r: 54 }, { sheet: "theme.jpg", figure: "keep", crop: crop(548, 28, 188, 230) }, 3217, [
    box("base", 70, 28, 70, 0, 14, 0, 0x554034),
    box("tower", 28, 70, 28, 0, 48, 0, 0x554034),
    cone("roof", 44, 28, 44, 0, 92, 0, 0x43382e),
    box("door", 16, 18, 4, 0, 10, 36, 0x795237),
    box("window", 6, 8, 4, 0, 58, 14, 0xeea821)
  ]),
  entry("tree", "prop", { r: TREE_RADIUS }, { sheet: "theme.jpg", figure: "pine", crop: crop(0, 500, 180, 210) }, 244, [
    prism("trunk", 3, 4, 12, 5, 0, 6, 0, 0x8e755b),
    cone("crown", 28, 28, 28, 0, 24, 0, 0x353e27, 5)
  ]),
  entry("scenery", "prop", { r: sceneryForest().radiusBottom }, { sheet: "theme.jpg", figure: "pine trunk", crop: crop(1080, 160, 180, 260) }, 97, null)
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
  const cited = []
  const kinds = new Map()
  for (const line of markdown.split("\n")) {
    const token = line.match(/^\| ([a-z][a-z0-9-]*) \| #([0-9a-f]{6}) \| ((?:heroes|monsters|theme)\.jpg) \| (\d+),(\d+),(\d+),(\d+) \|/)
    if (token && token[1] !== "token") {
      const region = { x: Number(token[4]), y: Number(token[5]), w: Number(token[6]), h: Number(token[7]) }
      tokens.set(token[2], token[1])
      cited.push({ name: token[1], hex: token[2], sheet: token[3], region })
    }
    const kind = line.match(/^\| ([a-z][a-z0-9_]*) \| (hero|monster|building|prop) \| ((?:heroes|monsters|theme)\.jpg) \| ([^|]+?) \| (\d+),(\d+),(\d+),(\d+) \|/)
    if (kind && kind[1] !== "id") {
      kinds.set(kind[1], {
        family: kind[2],
        sheet: kind[3],
        figure: kind[4].trim(),
        crop: { x: Number(kind[5]), y: Number(kind[6]), w: Number(kind[7]), h: Number(kind[8]) }
      })
    }
  }
  return { tokens, cited, kinds }
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

export function uncitedPaletteProblems(markdown) {
  const problems = []
  for (const line of markdown.split("\n")) {
    const cited = line.match(/^\| ([a-z][a-z0-9-]*) \| #([0-9a-f]{6}) \| ((?:heroes|monsters|theme)\.jpg) \| (\d+),(\d+),(\d+),(\d+) \|/)
    const loose = line.match(/^\| ([a-z][a-z0-9-]*) \| #([0-9a-f]{6}) \|/)
    if (loose && loose[1] !== "token" && !cited) {
      problems.push(`palette token ${loose[1]} does not cite a sheet and region`)
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
    const crop = model.concept.crop
    if (!row.crop || !crop || row.crop.x !== crop.x || row.crop.y !== crop.y || row.crop.w !== crop.w || row.crop.h !== crop.h) {
      problems.push(`${model.id} crop disagrees with STYLE.md`)
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
    const frame = concept && concept.crop
    if (!concept || !conceptSheets.includes(concept.sheet) || !String(concept.figure || "").trim() || !frame || !(frame.w > 0) || !(frame.h > 0)) {
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
