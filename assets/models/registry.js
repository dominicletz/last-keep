import { heroParts } from "../js/heroes.js"
import { batVoxels, goblinVoxels, ogreVoxels, riderVoxels, skeletonVoxels, wolfVoxels } from "./figures.js"
import { sceneryForest } from "../js/scenery.js"

// A mesh may extend this many times past the gameplay radius. The farmer brim
// is the wide mark (26 against 14) and still fits. A mesh at 3x does not.
export const fitSlack = 2

// Same-family silhouettes at or above this IoU fail. They have to read apart.
export const iouLimit = 0.85

export const conceptSheets = ["heroes.jpg", "monsters.jpg", "theme.jpg"]

export const yardProps = ["keep", "tree", "scenery"]

const HERO_RADIUS = 14
const TREE_RADIUS = 16
const STONE = 0x4b3c33
const COURSE = 0x654e41
const JOINT = 0x2c2a2a
const THATCH = 0x43382e
const PALISADE = 0x795237
const FLAME = 0xeea821
const WHEAT = 0x976122
const TORCH = 0xf5751e
const WOOD = 0x8e755b
const PINE = 0x353e27
const ROBE = 0x3e6dab
const GEM = 0x23d9f3
const HIDE = 0x4d433b
const DUSK = 0x5d505b
const GRASS = 0x374115

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
  hero("warrior", 2092, crop(24, 158, 268, 412)),
  hero("mage", 1772, crop(312, 124, 196, 448)),
  hero("scout", 2074, crop(524, 100, 216, 480)),
  hero("farmer", 2071, crop(752, 98, 250, 480)),
  hero("engineer", 1987, crop(1016, 158, 224, 432)),
  monster("goblin", 16, 682, crop(16, 328, 236, 246), goblinVoxels()),
  monster("skeleton", 13, 835, crop(260, 328, 260, 246), skeletonVoxels()),
  monster("wolf", 13, 445, crop(760, 340, 270, 245), wolfVoxels()),
  monster("troll", 22, 1884, crop(524, 292, 226, 286), ogreVoxels(), "ogre"),
  monster("bat", 12, 347, crop(408, 68, 260, 96), batVoxels(), "bat"),
  monster("boss", 34, 4898, crop(1000, 70, 275, 520), riderVoxels(), "dark rider"),
  building("wall", 16, 1411, crop(160, 280, 250, 220), palisadeParts(), "palisade"),
  building("tower", 16, 1028, crop(590, 36, 120, 130), [
    box("shaft", 18, 32, 18, 0, 16, 0, STONE),
    box("merlon", 6, 6, 6, -8, 34, 0, STONE),
    box("merlon", 6, 6, 6, 8, 34, 0, STONE),
    box("flame", 5, 6, 5, 0, 38, 0, FLAME)
  ], "stone tower"),
  building("trap", 15, 480, crop(520, 490, 100, 90), [box("trap", 22, 6, 22, 0, 3, 0, HIDE)], "ground torch"),
  building("field", 16, 574, crop(740, 300, 250, 140), wheatParts(), "wheat"),
  building("forge", 18, 928, crop(500, 190, 200, 150), [
    box("wall", 26, 16, 22, 0, 8, 0, STONE),
    cone("roof", 32, 14, 28, 0, 22, 0, THATCH),
    box("door", 8, 10, 3, 0, 5, 12, PALISADE),
    box("flame", 5, 6, 5, 8, 18, 8, TORCH)
  ], "lit house"),
  building("mage_tower", 18, 952, crop(470, 330, 160, 140), [
    box("shaft", 16, 34, 16, 0, 17, 0, ROBE),
    cone("cap", 20, 12, 20, 0, 40, 0, DUSK),
    box("gem", 5, 5, 5, 0, 48, 0, GEM)
  ], "spell light"),
  entry("keep", "prop", { r: 54 }, { sheet: "theme.jpg", figure: "keep", crop: crop(548, 28, 188, 230) }, 11930, null),
  entry("tree", "prop", { r: TREE_RADIUS }, { sheet: "theme.jpg", figure: "pine", crop: crop(0, 500, 180, 210) }, 682, pineParts()),
  entry("scenery", "prop", { r: sceneryForest().radiusBottom }, { sheet: "theme.jpg", figure: "pine trunk", crop: crop(1080, 160, 180, 260) }, 220, null)
]

function pineParts() {
  return [
    prism("trunk", 2.2, 4.4, 16, 5, 0, 8, 0, WOOD),
    cone("bough", 30, 14, 30, 0, 16, 0, GRASS, 6),
    cone("bough", 22, 16, 22, 0, 28, 0, PINE, 6),
    cone("bough", 12, 14, 12, 0, 40, 0, PINE, 5)
  ]
}

function palisadeParts() {
  const parts = [-16, -8, 0, 8, 16].map((x) => box("post", 7, 40, 7, x, 20, 0, PALISADE))
  parts.push(box("rail", 40, 5, 5, 0, 30, 0, WOOD))
  parts.push(box("rail", 40, 5, 5, 0, 16, 0, WOOD))
  parts.push(box("flame", 4, 6, 4, 16, 44, 0, FLAME))
  return parts
}

function wheatParts() {
  const parts = [box("soil", 28, 2, 28, 0, 1, 0, HIDE)]
  for (const [x, z] of [
    [-8, -8],
    [-8, 8],
    [0, 0],
    [8, -8],
    [8, 8]
  ]) {
    parts.push(cone("stalk", 3, 14, 3, x, 9, z, WHEAT))
  }
  return parts
}

// Stacked courses. Mortar separates the shadowed stone from the lit course,
// and the odd courses step in so the blocks read at game zoom.
function shellCourses(height, bottom, width, depth) {
  const parts = []
  const pattern = [
    { h: 8, color: STONE },
    { h: 6, color: JOINT },
    { h: 8, color: COURSE },
    { h: 6, color: JOINT }
  ]
  let y = bottom
  let i = 0
  const top = bottom + height
  while (y < top - 0.5) {
    const spec = pattern[i % pattern.length]
    const h = Math.min(spec.h, top - y)
    const inset = i % 2 === 0 ? 0 : 2
    parts.push(box("course", width - inset, h, depth - inset, 0, y + h / 2, 0, spec.color))
    y += h
    i += 1
  }
  return parts
}

// Rank 0 is the gallery keep. Each raise adds a course of stone.
// Rank 2 grows battlements. Rank 4 flies a banner.
// The foot has timber houses, the top is a lit belfry, and pines stand behind it.
export function keepParts(rank = 0) {
  const step = Math.max(0, Math.min(4, rank | 0))
  const towerH = 104 + step * 14
  const towerY = 32 + towerH / 2
  const roofY = 32 + towerH + 10
  const parts = [
    box("house", 34, 22, 28, -46, 11, 8, WOOD),
    cone("eave", 40, 14, 34, -46, 26, 8, THATCH),
    box("house", 30, 18, 26, 44, 9, -4, WOOD),
    cone("eave", 36, 12, 30, 44, 22, -4, THATCH),
    box("base", 64, 28, 64, 0, 16, 0, STONE),
    ...shellCourses(32, 0, 72, 72),
    box("tower", 26, towerH, 26, 0, towerY, 0, STONE),
    ...shellCourses(towerH, 32, 32, 32),
    box("merlon", 8, 10, 8, -12, roofY - 8, 12, COURSE),
    box("merlon", 8, 10, 8, 12, roofY - 8, 12, JOINT),
    box("merlon", 8, 10, 8, -12, roofY - 8, -12, COURSE),
    box("merlon", 8, 10, 8, 12, roofY - 8, -12, STONE),
    box("belfry", 12, 16, 6, 0, roofY - 18, 22, FLAME),
    cone("roof", 46, 26, 46, 0, roofY + 6, 0, THATCH),
    box("door", 16, 20, 4, 0, 12, 38, PALISADE),
    box("window", 8, 14, 4, 0, 58, 22, FLAME),
    box("brazier", 10, 4, 10, 26, 34, 26, HIDE),
    box("flame", 8, 12, 8, 26, 42, 26, FLAME),
    prism("pine", 2.2, 3.4, 20, 5, -22, 10, -62, WOOD),
    cone("pine", 18, 30, 18, -22, 30, -62, PINE, 5),
    prism("pine", 2, 3, 16, 5, 18, 8, -70, WOOD),
    cone("pine", 14, 24, 14, 18, 24, -70, PINE, 5)
  ]
  if (step >= 2) parts.push(box("battlement", 40, 8, 10, 0, 32 + towerH - 6, 22, STONE))
  if (step >= 4) parts.push(box("banner", 3, 18, 3, 0, roofY + 24, 0, PALISADE))
  return parts
}

export function models() {
  const look = sceneryForest()
  return REGISTRY.map((model) => {
    if (model.family === "hero") {
      const parts = heroParts(model.id)
      return { ...model, parts, voxels: parts.voxelCount }
    }
    if (model.family === "monster") {
      return { ...model, parts: model.parts.map((part) => ({ ...part })), voxels: model.parts.voxelCount }
    }
    if (model.id === "keep") return { ...model, parts: keepParts(0) }
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

const KEEP_BODY = new Set(["base", "tower", "course", "merlon", "battlement"])

function rgbOf(hex) {
  const value = typeof hex === "string" ? Number.parseInt(hex.replace("#", ""), 16) : hex
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function colorDist(a, b) {
  const left = rgbOf(a)
  const right = rgbOf(b)
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

// The keep body has to read as the belfry stone, with more than one tone.
// Roof stays thatch. A uniform brown shaft fails.
export function keepStoneProblems(listed, cited) {
  const problems = []
  const stone = cited.find((token) => token.name === "stone")
  const keep = listed.find((model) => model.id === "keep")
  if (!stone || !keep) {
    problems.push("keep stone check is missing the keep or the stone token")
    return problems
  }
  const crop = keep.concept && keep.concept.crop
  const region = stone.region
  const inside =
    crop &&
    region &&
    region.x >= crop.x &&
    region.y >= crop.y &&
    region.x + region.w <= crop.x + crop.w &&
    region.y + region.h <= crop.y + crop.h
  if (!inside) problems.push(`stone #${stone.hex} is not sampled from the keep belfry crop`)
  const body = (keep.parts || []).filter((part) => KEEP_BODY.has(part.name))
  if (body.length === 0) {
    problems.push("keep has no stone body")
    return problems
  }
  const volume = new Map()
  for (const part of body) {
    const hex = hexOf(part.color).slice(1)
    const size = Math.abs(part.w * part.h * part.d) || 0
    volume.set(hex, (volume.get(hex) || 0) + size)
  }
  let dominant = null
  let best = -1
  for (const [hex, size] of volume) {
    if (size > best) {
      best = size
      dominant = hex
    }
  }
  const dist = colorDist(dominant, stone.hex)
  if (dist > 18) {
    problems.push(`keep body dominant #${dominant} is ${dist.toFixed(1)} away from stone #${stone.hex}`)
  }
  if (volume.size < 3) problems.push("keep body does not vary by course, so the masonry does not read")
  const roof = (keep.parts || []).find((part) => part.name === "roof")
  if (!roof || hexOf(roof.color) !== "#43382e") problems.push("keep roof is not the thatch token")
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
