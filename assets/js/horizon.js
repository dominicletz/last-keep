import * as THREE from "three"
import { trackGeometry } from "./meshes.js"
import { treeCard, treeSheet } from "./yard_cards.js"
import { groundColor, horizonColor, lightName, ringColor, sunsetColor } from "./scene.js"
import { groundTile, onGroundTiles, sampleGroundTile } from "./seam_tiles.js"
import { phash2, pictureCell, roundAway } from "./world_biome.js"

export { phash2, pictureCell }

const CELL = 36
const CHUNK = 512
const SHADE = 0x2c3416
const HORIZON_SPAN = 48000
const HORIZON_TEX = 320
const WINDOW = 4608
const TREE_CAP = 180
const YARD = 380
const MIST = 0.8
const MASK = 32
const ATLAS_CELL = 256
const ATLAS_COLS = 4
const ATLAS_ROWS = 2
const ATLAS_W = ATLAS_CELL * ATLAS_COLS
const ATLAS_H = ATLAS_CELL * ATLAS_ROWS
const BIOMES = ["meadow", "pine", "ruins", "cliff", "river", "ford", "hill", "mountain"]
const BIOME_ID = Object.fromEntries(BIOMES.map((name, index) => [name, index]))

export const UNSEEN_DAY = 0x0a160c
export const UNSEEN_NIGHT = 0x16141d
export const HORIZON_TINT = {
  day: 0xffffff,
  dusk: 0xc8a484,
  night: 0x363248
}
const GROUND_SHADE = {
  day: [0.46, 0.44, 0.38],
  dusk: [0.74, 0.64, 0.52],
  night: [0.95, 0.95, 1.0]
}

export function unseenMistHex(light) {
  return light === "night" ? UNSEEN_NIGHT : UNSEEN_DAY
}

export function horizonTintHex(light) {
  return HORIZON_TINT[light] || HORIZON_TINT.day
}

// Yard pines and both forest-wall rings. The variant is the hash of the
// cell, so two trees on the same spot agree and a rebuilt ring does not
// stripe a, b, a, b.
export function pineVariant(x, z) {
  const variants = treeSheet.variants
  return variants[phash2([Math.round(x), Math.round(z)]) % variants.length]
}

function rgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

// Meadow, ruins, pine, cliff, river, ford, hill and mountain sample the tiles
// that passed the column seam. A missing tile keeps the old flat colour.
// Hill and mountain keep their lifts.
export function biomeColor(name, worldX = 0, worldZ = 0) {
  if (name === "meadow") {
    const sample = sampleGroundTile("meadow", worldX, worldZ)
    if (sample) return sample
  }
  if (name === "ford") {
    const sample = sampleGroundTile("ford", worldX, worldZ)
    if (sample) return sample
    const meadow = sampleGroundTile("meadow", worldX, worldZ)
    if (meadow) return meadow
  }
  if (name === "ruins") {
    const sample = sampleGroundTile("ruins", worldX, worldZ)
    if (sample) return sample
  }
  if (name === "pine") {
    const sample = sampleGroundTile("pine", worldX, worldZ)
    if (sample) return sample
  }
  if (name === "cliff") {
    const sample = sampleGroundTile("cliff", worldX, worldZ)
    if (sample) return sample
  }
  if (name === "river") {
    const sample = sampleGroundTile("river", worldX, worldZ)
    if (sample) return sample
    return rgb(SHADE)
  }
  if (name === "pine") return rgb(SHADE)
  if (name === "cliff") return rgb(ringColor)
  if (name === "hill") {
    const sample = sampleGroundTile("hill", worldX, worldZ)
    if (sample) return sample
    return rgb(sunsetColor)
  }
  if (name === "mountain") {
    const sample = sampleGroundTile("mountain", worldX, worldZ)
    if (sample) return sample
    return rgb(horizonColor)
  }
  return rgb(groundColor)
}

const ATLAS_TONE = {
  meadow: [0x5c, 0x64, 0x2f, 0.38, 108, 116, 32],
  pine: [0x2c, 0x36, 0x18, 0.54, 255, 255, 0],
  ruins: [0x56, 0x4a, 0x42, 0.24, 255, 255, 0],
  cliff: [0x38, 0x30, 0x2c, 0.34, 255, 255, 0],
  ford: [0x68, 0x56, 0x3e, 0.16, 255, 255, 0]
}

function paintBiomeAtlas(dest) {
  const margin = 32
  const weights = new Float32Array(margin)
  for (let i = 0; i < margin; i++) {
    const t = (i + 1) / (margin + 1)
    weights[i] = t * t * (3 - 2 * t)
  }
  const tmp = new Uint8Array(ATLAS_CELL * (ATLAS_CELL + margin) * 3)
  for (let id = 0; id < BIOMES.length; id++) {
    const name = BIOMES[id]
    const col = id % ATLAS_COLS
    const row = (id / ATLAS_COLS) | 0
    const ox = col * ATLAS_CELL
    const oy = row * ATLAS_CELL
    const tile = groundTile(name) || (name === "ford" ? groundTile("meadow") : null)
    const tone = ATLAS_TONE[name]
    if (!tile) {
      let [r, g, b] = biomeColor(name)
      if (tone) {
        const k = tone[3]
        r = Math.min(Math.round(r + (tone[0] - r) * k), tone[4])
        g = Math.min(Math.round(g + (tone[1] - g) * k), tone[5])
        b = Math.max(Math.round(b + (tone[2] - b) * k), tone[6])
      }
      for (let ty = 0; ty < ATLAS_CELL; ty++) {
        let o = ((oy + ty) * ATLAS_W + ox) * 4
        for (let tx = 0; tx < ATLAS_CELL; tx++) {
          dest[o] = r
          dest[o + 1] = g
          dest[o + 2] = b
          dest[o + 3] = 255
          o += 4
        }
      }
      continue
    }
    const src = tile.rgba
    const sw = tile.width
    const sh = tile.height
    const interior = name === "ruins" || name === "cliff"
    const tr = tone ? tone[0] : 0
    const tg = tone ? tone[1] : 0
    const tb = tone ? tone[2] : 0
    const tk = tone ? tone[3] : 0
    const rMax = tone ? tone[4] : 255
    const gMax = tone ? tone[5] : 255
    const bMin = tone ? tone[6] : 0
    const rows = ATLAS_CELL + margin
    for (let uY = 0; uY < rows; uY++) {
      const sy = interior ? (192 + (((uY + margin) * 2 + 1) & 639)) % sh : (((uY + margin) * 3 + 64) & 1023) % sh
      const rowBase = sy * sw
      const outRow = uY * ATLAS_CELL * 3
      for (let tx = 0; tx < ATLAS_CELL; tx++) {
        const sx = interior ? (192 + (((tx + margin) * 2 + 1) & 639)) % sw : (((tx + margin) * 3 + 64) & 1023) % sw
        const so = (rowBase + sx) * 4
        let r = src[so]
        let g = src[so + 1]
        let b = src[so + 2]
        if (tx < margin) {
          const tx2 = tx + ATLAS_CELL + margin
          const sx2 = interior ? (192 + ((tx2 * 2 + 1) & 639)) % sw : ((tx2 * 3 + 64) & 1023) % sw
          const so2 = (rowBase + sx2) * 4
          const w = weights[tx]
          r = src[so2] + (r - src[so2]) * w
          g = src[so2 + 1] + (g - src[so2 + 1]) * w
          b = src[so2 + 2] + (b - src[so2 + 2]) * w
        }
        if (tone) {
          r = Math.min(r + (tr - r) * tk, rMax)
          g = Math.min(g + (tg - g) * tk, gMax)
          b = Math.max(b + (tb - b) * tk, bMin)
        }
        const to = outRow + tx * 3
        tmp[to] = Math.round(r)
        tmp[to + 1] = Math.round(g)
        tmp[to + 2] = Math.round(b)
      }
    }
    for (let ty = 0; ty < ATLAS_CELL; ty++) {
      const inRow = ty * ATLAS_CELL * 3
      const tailRow = (ty + ATLAS_CELL) * ATLAS_CELL * 3
      const w = ty < margin ? weights[ty] : 1
      let o = ((oy + ty) * ATLAS_W + ox) * 4
      for (let tx = 0; tx < ATLAS_CELL; tx++) {
        const i = inRow + tx * 3
        if (ty < margin) {
          const j = tailRow + tx * 3
          dest[o] = Math.round(tmp[j] + (tmp[i] - tmp[j]) * w)
          dest[o + 1] = Math.round(tmp[j + 1] + (tmp[i + 1] - tmp[j + 1]) * w)
          dest[o + 2] = Math.round(tmp[j + 2] + (tmp[i + 2] - tmp[j + 2]) * w)
        } else {
          dest[o] = tmp[i]
          dest[o + 1] = tmp[i + 1]
          dest[o + 2] = tmp[i + 2]
        }
        dest[o + 3] = 255
        o += 4
      }
    }
  }
}

function biomeLift(name) {
  if (name === "mountain") return 120
  if (name === "hill") return 56
  if (name === "cliff") return 16
  if (name === "ruins") return 8
  return 0
}

function landHeight(seed, attempt, x, z) {
  if (Math.max(Math.abs(x), Math.abs(z)) <= 420) return 0
  let h = 0
  for (const dx of [0, 72, -72]) {
    for (const dz of [0, 72, -72]) h += biomeLift(pictureCell(seed, attempt, x + dx, z + dz))
  }
  return h / 9
}

function paintWindow(seed, attempt, originX, originZ) {
  const rgba = new Uint8Array(HORIZON_TEX * HORIZON_TEX * 4)
  // Cache biome IDs per 36-unit cell across the 4608 window (~130x130 cells
  // instead of 320x320 texels); the shader reads biome RGB from tileAtlas.
  const minCellX = roundAway((originX - WINDOW / 2) / CELL) - 1
  const minCellZ = roundAway((originZ - WINDOW / 2) / CELL) - 1
  const cellSpan = Math.ceil(WINDOW / CELL) + 4
  const ids = new Int8Array(cellSpan * cellSpan).fill(-1)
  for (let iy = 0; iy < HORIZON_TEX; iy++) {
    const v = (iy + 0.5) / HORIZON_TEX
    const worldZ = originZ - (v - 0.5) * WINDOW
    const cz = roundAway(worldZ / CELL) - minCellZ
    const rowOff = cz * cellSpan
    for (let ix = 0; ix < HORIZON_TEX; ix++) {
      const u = (ix + 0.5) / HORIZON_TEX
      const worldX = originX + (u - 0.5) * WINDOW
      const cx = roundAway(worldX / CELL) - minCellX
      const slot = rowOff + cx
      let id = ids[slot]
      if (id < 0) {
        id = BIOME_ID[pictureCell(seed, attempt, worldX, worldZ)] ?? 0
        ids[slot] = id
      }
      rgba[(iy * HORIZON_TEX + ix) * 4 + 3] = id * 32 + 16
    }
  }
  return rgba
}

// One upright quad per far pine, the pine sheet's variant cut, feet at y 0.
// Two triangles a tree (the old cones were four), one draw call per variant.
function pineGeometry(variant) {
  const card = treeCard(variant)
  const geometry = new THREE.PlaneGeometry(card.w, card.h)
  geometry.translate(0, card.h * (0.5 - card.centerY), 0)
  return trackGeometry(geometry)
}

// The far pines around a camera: pine cells of the picture outside the yard
// within reach, at most TREE_CAP, chosen by hash so they do not shift as the
// camera moves inside one chunk. Each carries the sheet variant it draws.
export function farPines(seed, attempt, camX, camZ, reach) {
  const [i0, i1] = cellRange(camX, reach)
  const [j0, j1] = cellRange(camZ, reach)
  const found = []
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * CELL
      const z = j * CELL
      if (Math.abs(x) < YARD && Math.abs(z) < YARD) continue
      if (Math.hypot(x - camX, z - camZ) > reach) continue
      if (pictureCell(seed, attempt, x, z) !== "pine") continue
      found.push({ x, z, hash: phash2([seed, i, j, attempt]) })
    }
  }
  found.sort((a, b) => a.hash - b.hash)
  const vs = treeSheet.variants
  return found.slice(0, TREE_CAP).map((t) => ({ ...t, variant: vs[t.hash % vs.length] }))
}

export const FAR_PINE_CAP = TREE_CAP

// The yard tile covers ±380 and fades radially from 316 to 364. Stopping the
// inner cutout at 210 (diagonal 297 < 316) guarantees horizon terrain sits
// under the full circular yard edge without doubling fill under the plaza.
function farGeometry() {
  const outer = HORIZON_SPAN / 2
  const inner = 210
  const positions = []
  const push = (x, y, z) => positions.push(x, y, z)
  const quad = (x0, y0, x1, y1) => {
    push(x0, y0, 0)
    push(x1, y0, 0)
    push(x1, y1, 0)
    push(x0, y0, 0)
    push(x1, y1, 0)
    push(x0, y1, 0)
  }
  quad(-outer, -outer, outer, -inner)
  quad(-outer, inner, outer, outer)
  quad(inner, -inner, outer, inner)
  quad(-outer, -inner, -inner, inner)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return trackGeometry(geometry)
}

function cellRange(origin, reach) {
  const min = roundAway((origin - reach) / CELL) - 1
  const max = roundAway((origin + reach) / CELL) + 1
  return [min, max]
}

export function mountPicture(scene, options = {}) {
  const bytes = paintWindow(1, 0, 0, 0)
  const map = new THREE.DataTexture(bytes, HORIZON_TEX, HORIZON_TEX)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
  map.flipY = false
  map.needsUpdate = true

  const atlasBytes = new Uint8Array(ATLAS_W * ATLAS_H * 4)
  paintBiomeAtlas(atlasBytes)
  const tileAtlas = new THREE.DataTexture(atlasBytes, ATLAS_W, ATLAS_H)
  tileAtlas.colorSpace = THREE.SRGBColorSpace
  tileAtlas.magFilter = THREE.NearestFilter
  tileAtlas.minFilter = THREE.NearestFilter
  tileAtlas.wrapS = THREE.ClampToEdgeWrapping
  tileAtlas.wrapT = THREE.ClampToEdgeWrapping
  tileAtlas.generateMipmaps = false
  tileAtlas.flipY = false
  tileAtlas.needsUpdate = true

  const maskBytes = new Uint8Array(MASK * MASK * 4)
  const mask = new THREE.DataTexture(maskBytes, MASK, MASK)
  mask.colorSpace = THREE.NoColorSpace
  mask.magFilter = THREE.LinearFilter
  mask.minFilter = THREE.LinearFilter
  mask.wrapS = THREE.ClampToEdgeWrapping
  mask.wrapT = THREE.ClampToEdgeWrapping
  mask.generateMipmaps = false
  mask.flipY = false
  mask.needsUpdate = true

  const mistStrength = { value: 0 }
  const mistColor = { value: new THREE.Color(0x4e4651) }
  const unseenColor = { value: new THREE.Color(UNSEEN_DAY) }
  const phaseTint = { value: new THREE.Color(HORIZON_TINT.day) }
  const groundShade = { value: new THREE.Vector3(...GROUND_SHADE.day) }
  const windowOrigin = { value: new THREE.Vector2(0, 0) }
  const windowSpan = { value: WINDOW }
  // Scene fog at 0.9/span pulls a stone texel inside the clear color on the
  // ground the lower 45% of the frame still shows. This fade starts past that.
  const horizonFogNear = { value: 2105 }
  const horizonFogFar = { value: 3828 }
  const material = new THREE.MeshBasicMaterial({ map, color: 0xffffff, fog: false })
  material.customProgramCacheKey = () => "horizon-skirt-hd2d"
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tileAtlas = { value: tileAtlas }
    shader.uniforms.mistMask = { value: mask }
    shader.uniforms.mistStrength = mistStrength
    shader.uniforms.mistColor = mistColor
    shader.uniforms.unseenColor = unseenColor
    shader.uniforms.phaseTint = phaseTint
    shader.uniforms.groundShade = groundShade
    shader.uniforms.windowOrigin = windowOrigin
    shader.uniforms.windowSpan = windowSpan
    shader.uniforms.horizonFogNear = horizonFogNear
    shader.uniforms.horizonFogFar = horizonFogFar
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec2 windowOrigin;\nuniform float windowSpan;\nvarying vec3 vHorizonWorld;"
      )
      .replace(
        "#include <project_vertex>",
        "vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n\t#include <project_vertex>"
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
uniform sampler2D tileAtlas;
uniform sampler2D mistMask;
uniform float mistStrength;
uniform vec3 mistColor;
uniform vec3 unseenColor;
uniform vec3 phaseTint;
uniform vec3 groundShade;
uniform vec2 windowOrigin;
uniform float windowSpan;
uniform float horizonFogNear;
uniform float horizonFogFar;
varying vec3 vHorizonWorld;

vec2 horizonUvFor(vec2 worldXz) {
  return clamp(vec2((worldXz.x - windowOrigin.x) / windowSpan + 0.5, 0.5 - (worldXz.y - windowOrigin.y) / windowSpan), 0.001, 0.999);
}

float biomeIdAt(vec2 worldXz) {
  return floor(texture2D(map, horizonUvFor(worldXz)).a * 8.0 + 0.01);
}

vec3 sampleAtlasTile(float biomeId, vec2 gridPos) {
  float id = clamp(floor(biomeId + 0.5), 0.0, 7.0);
  float col = mod(id, 4.0);
  float row = floor(id / 4.0);
  vec2 local = mod(gridPos, 256.0) + 0.5;
  vec2 uv = (vec2(col, row) * 256.0 + local) / vec2(1024.0, 512.0);
  return texture2D(tileAtlas, uv).rgb;
}`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
	if (abs(vHorizonWorld.x) < 210.0 && abs(vHorizonWorld.z) < 210.0) discard;
	vec2 gridPos = floor(vHorizonWorld.xz / 0.84);
	vec2 pixelWorld = (gridPos + 0.5) * 0.84;
	float r2 = dot(pixelWorld, pixelWorld);
	vec3 tileRgb;
	if (r2 < 135424.0) {
		tileRgb = sampleAtlasTile(0.0, gridPos);
	} else {
		float keepBlend = smoothstep(368.0, 430.0, sqrt(r2));
		vec2 warped = pixelWorld + vec2(
			sin(pixelWorld.y * 0.052 + pixelWorld.x * 0.019),
			cos(pixelWorld.x * 0.052 - pixelWorld.y * 0.019)
		) * (8.5 * keepBlend);
		vec2 cellIdx = floor(warped / 36.0);
		vec2 cellFrac = warped / 36.0 - cellIdx;
		vec2 c00 = cellIdx * 36.0;
		float b00 = biomeIdAt(c00);
		float b10 = biomeIdAt(c00 + vec2(36.0, 0.0));
		float b01 = biomeIdAt(c00 + vec2(0.0, 36.0));
		float b11 = biomeIdAt(c00 + vec2(36.0, 36.0));
		if (b00 == b10 && b00 == b01 && b00 == b11) {
			tileRgb = sampleAtlasTile(b00, gridPos);
		} else {
			float tuft = fract(sin(dot(gridPos, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
			vec2 bw = smoothstep(0.14, 0.86, cellFrac + tuft * 0.24);
			vec3 s00 = sampleAtlasTile(b00, gridPos);
			vec3 s10 = b10 == b00 ? s00 : sampleAtlasTile(b10, gridPos);
			vec3 s01 = b01 == b00 ? s00 : (b01 == b10 ? s10 : sampleAtlasTile(b01, gridPos));
			vec3 s11 = b11 == b00 ? s00 : (b11 == b10 ? s10 : (b11 == b01 ? s01 : sampleAtlasTile(b11, gridPos)));
			tileRgb = mix(mix(s00, s10, bw.x), mix(s01, s11, bw.x), bw.y);
		}
	}
	float swell = 0.94 + 0.06 * sin(pixelWorld.x * 0.015 + pixelWorld.y * 0.011);
	diffuseColor.rgb = tileRgb * swell * phaseTint * groundShade;
	if (mistStrength > 0.0) {
		vec2 mistUv = (vHorizonWorld.xz / 512.0 + 16.0) / 32.0;
		float known = texture2D(mistMask, mistUv).r;
		diffuseColor.rgb = mix(mix(diffuseColor.rgb, unseenColor, mistStrength), diffuseColor.rgb, known);
	}
	float fogD = length(vHorizonWorld - cameraPosition);
	float fogF = smoothstep(horizonFogNear, horizonFogFar, fogD);
	diffuseColor.rgb = mix(diffuseColor.rgb, mistColor, fogF);`
      )
  }

  const horizon = new THREE.Mesh(farGeometry(), material)
  horizon.rotation.x = -Math.PI / 2
  horizon.position.y = -0.25
  horizon.userData.role = "horizon"
  horizon.frustumCulled = false
  scene.add(horizon)

  const RIDGE = 3200
  const RIDGE_SEG = 20
  const ridgeGeo = trackGeometry(new THREE.PlaneGeometry(RIDGE, RIDGE, RIDGE_SEG, RIDGE_SEG))
  const ridgePos = ridgeGeo.getAttribute("position")
  const ridgeXY = new Float32Array(ridgePos.count * 2)
  for (let i = 0; i < ridgePos.count; i++) {
    ridgeXY[i * 2] = ridgePos.getX(i)
    ridgeXY[i * 2 + 1] = ridgePos.getY(i)
  }
  const ridge = new THREE.Mesh(ridgeGeo, material)
  ridge.rotation.x = -Math.PI / 2
  ridge.position.y = -0.15
  ridge.userData.role = "horizon"
  ridge.frustumCulled = false
  scene.add(ridge)

  const loadMap = options.loadMap || ((url) => new THREE.TextureLoader().load(url))
  const trees = {}
  for (const variant of treeSheet.variants) {
    const card = treeCard(variant)
    const tex = loadMap("/" + treeSheet.url)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.repeat.set(card.repeat[0], card.repeat[1])
    tex.offset.set(card.offset[0], card.offset[1])
    const mesh = new THREE.InstancedMesh(
      pineGeometry(variant),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide }),
      TREE_CAP
    )
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.userData.role = "far-pine"
    mesh.userData.variant = variant
    scene.add(mesh)
    trees[variant] = mesh
  }

  const dummy = new THREE.Object3D()
  const ahead = new THREE.Vector3()
  let windowKey = ""
  let mistKey = ""
  let treeKey = ""
  onGroundTiles(() => {
    paintBiomeAtlas(atlasBytes)
    tileAtlas.needsUpdate = true
  })

  function paint(seed, attempt, camera) {
    let lookX = 0
    let lookZ = 0
    if (camera) {
      camera.getWorldDirection(ahead)
      const drop = ahead.y < -0.05 ? -camera.position.y / ahead.y : 0
      lookX = camera.position.x + ahead.x * drop
      lookZ = camera.position.z + ahead.z * drop
    }
    const ox = Math.round(lookX / CHUNK) * CHUNK
    const oz = Math.round(lookZ / CHUNK) * CHUNK
    const key = `${seed}:${attempt}:${ox}:${oz}`
    if (key === windowKey) return
    windowKey = key
    windowOrigin.value.set(ox, oz)
    map.image.data.set(paintWindow(seed, attempt, ox, oz))
    map.needsUpdate = true
    ridge.position.set(ox, -0.15, oz)
    for (let i = 0; i < ridgePos.count; i++) {
      const x = ox + ridgeXY[i * 2]
      const z = oz - ridgeXY[i * 2 + 1]
      ridgePos.setZ(i, landHeight(seed, attempt, x, z))
    }
    ridgePos.needsUpdate = true
  }

  function mist(snap, seeded) {
    const chunks = seeded ? snap.chunks || [] : []
    const key = seeded ? chunks.map((chunk) => `${chunk.cx},${chunk.cy}`).join("|") : "off"
    const phase = lightName(snap)
    const tintHex = horizonTintHex(phase)
    const shade = GROUND_SHADE[phase] || GROUND_SHADE.day
    mistStrength.value = seeded ? MIST : 0
    mistColor.value.setHex(phase === "night" ? 0x322c3c : 0x4e4651)
    unseenColor.value.setHex(unseenMistHex(phase))
    phaseTint.value.setHex(tintHex)
    groundShade.value.set(shade[0], shade[1], shade[2])
    for (const mesh of Object.values(trees)) mesh.material.color.setHex(tintHex)
    if (key === mistKey) return
    mistKey = key
    maskBytes.fill(0)
    for (const chunk of chunks) {
      const ix = chunk.cx + 16
      const iy = chunk.cy + 16
      if (ix < 0 || iy < 0 || ix >= MASK || iy >= MASK) continue
      const o = (iy * MASK + ix) * 4
      maskBytes[o] = 255
      maskBytes[o + 1] = 255
      maskBytes[o + 2] = 255
      maskBytes[o + 3] = 255
    }
    mask.needsUpdate = true
  }

  function placeTrees(camera, seed, attempt, halfH) {
    const reach = (halfH / Math.tan(THREE.MathUtils.degToRad(7.5))) * 1.42
    const cx = Math.floor(camera.position.x / CHUNK)
    const cz = Math.floor(camera.position.z / CHUNK)
    const key = `${seed}:${attempt}:${cx}:${cz}:${Math.round(reach)}`
    if (key === treeKey) return
    treeKey = key
    const picks = farPines(seed, attempt, camera.position.x, camera.position.z, reach)
    for (const mesh of Object.values(trees)) mesh.count = 0
    for (const t of picks) {
      const mesh = trees[t.variant]
      // Face the camera once per placement; the key changes with the chunk.
      dummy.position.set(t.x, 0, t.z)
      dummy.rotation.set(0, Math.atan2(camera.position.x - t.x, camera.position.z - t.z), 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(mesh.count++, dummy.matrix)
    }
    for (const mesh of Object.values(trees)) mesh.instanceMatrix.needsUpdate = true
  }

  return {
    sync(snap, camera, halfH) {
      const seeded = Number.isInteger(snap && snap.seed)
      const seed = seeded ? snap.seed : 1
      const attempt = seeded ? snap.attempt || 0 : 0
      paint(seed, attempt, camera)
      mist(snap || {}, seeded)
      const span = (halfH || 168) / Math.tan(THREE.MathUtils.degToRad(7.5))
      horizonFogNear.value = span * 1.65
      horizonFogFar.value = span * 3.0
      if (camera) placeTrees(camera, seed, attempt, halfH || 168)
    }
  }
}
