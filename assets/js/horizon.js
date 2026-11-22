import * as THREE from "three"
import { trackGeometry } from "./meshes.js"
import { treeCard, treeSheet } from "./yard_cards.js"
import { groundColor, horizonColor, lightName, ringColor, sunsetColor } from "./scene.js"
import { onGroundTiles, sampleGroundTile } from "./seam_tiles.js"
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
export const UNSEEN_DAY = 0x0a160c
export const UNSEEN_NIGHT = 0x16141d
export const HORIZON_TINT = {
  day: 0xffffff,
  dusk: 0xc8a484,
  night: 0x363248
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
  for (let iy = 0; iy < HORIZON_TEX; iy++) {
    for (let ix = 0; ix < HORIZON_TEX; ix++) {
      const u = (ix + 0.5) / HORIZON_TEX
      const v = (iy + 0.5) / HORIZON_TEX
      const worldX = originX + (u - 0.5) * WINDOW
      const worldZ = originZ - (v - 0.5) * WINDOW
      const [r, g, b] = biomeColor(pictureCell(seed, attempt, worldX, worldZ), worldX, worldZ)
      const o = (iy * HORIZON_TEX + ix) * 4
      rgba[o] = r
      rgba[o + 1] = g
      rgba[o + 2] = b
      rgba[o + 3] = 255
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

// The yard tile already covers ±380. Shading the horizon under that square
// doubled the ground fill on the software rasterizer and pushed the night
// smoke past its cap. The hole stops at 300 so the stippled yard edge still
// has land under it. Local Y becomes world -Z after the same -90° rotation
// the old plane used.
function farGeometry() {
  const outer = HORIZON_SPAN / 2
  const inner = 300
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
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearFilter
  map.flipY = false
  map.needsUpdate = true

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
  const windowOrigin = { value: new THREE.Vector2(0, 0) }
  const windowSpan = { value: WINDOW }
  // Scene fog at 0.9/span pulls a stone texel inside the clear color on the
  // ground the lower 45% of the frame still shows. This fade starts past that.
  const horizonFogNear = { value: 2105 }
  const horizonFogFar = { value: 3828 }
  const material = new THREE.MeshBasicMaterial({ map, color: 0xffffff, fog: false })
  material.customProgramCacheKey = () => "horizon-skirt"
  material.onBeforeCompile = (shader) => {
    shader.uniforms.mistMask = { value: mask }
    shader.uniforms.mistStrength = mistStrength
    shader.uniforms.mistColor = mistColor
    shader.uniforms.unseenColor = unseenColor
    shader.uniforms.phaseTint = phaseTint
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
        "#include <common>",
        "#include <common>\nuniform sampler2D mistMask;\nuniform float mistStrength;\nuniform vec3 mistColor;\nuniform vec3 unseenColor;\nuniform vec3 phaseTint;\nuniform vec2 windowOrigin;\nuniform float windowSpan;\nuniform float horizonFogNear;\nuniform float horizonFogFar;\nvarying vec3 vHorizonWorld;"
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n\tif (abs(vHorizonWorld.x) < 300.0 && abs(vHorizonWorld.z) < 300.0) discard;\n\tvec2 landUv = vec2((vHorizonWorld.x - windowOrigin.x) / windowSpan + 0.5, 0.5 - (vHorizonWorld.z - windowOrigin.y) / windowSpan);\n\tdiffuseColor.rgb = texture2D(map, clamp(landUv, 0.001, 0.999)).rgb * phaseTint;\n\tvec2 mistUv = (vHorizonWorld.xz / 512.0 + 16.0) / 32.0;\n\tfloat known = texture2D(mistMask, mistUv).r;\n\tdiffuseColor.rgb = mix(mix(diffuseColor.rgb, unseenColor, mistStrength), diffuseColor.rgb, known);\n\tfloat fogD = length(vHorizonWorld - cameraPosition);\n\tfloat fogF = smoothstep(horizonFogNear, horizonFogFar, fogD);\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, mistColor, fogF);"
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
    windowKey = ""
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
    mistStrength.value = seeded ? MIST : 0
    mistColor.value.setHex(phase === "night" ? 0x322c3c : 0x4e4651)
    unseenColor.value.setHex(unseenMistHex(phase))
    phaseTint.value.setHex(tintHex)
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
