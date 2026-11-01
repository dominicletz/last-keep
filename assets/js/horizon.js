import * as THREE from "three"
import { trackGeometry } from "./meshes.js"
import { groundColor, horizonColor, lightName, ringColor, sunsetColor } from "./scene.js"

const CELL = 36
const CHUNK = 512
const RADIUS = 7200
const KEEP = 400
const HCONST = 0x9e3779b9
const HCONST_9 = 0x8ff34781
const SHADE = 0x2c3416
const HORIZON_SPAN = 48000
const HORIZON_TEX = 256
const TREE_CAP = 180
const YARD = 380
const MIST = 0.28
const MASK = 32

// Erlang round is half away from zero. Math.round sends -0.5 to 0.
function roundAway(q) {
  if (!Number.isFinite(q)) return 0
  return q >= 0 ? Math.round(q) : -Math.round(-q)
}

function u32(n) {
  return n >>> 0
}

function mix(a, b, c) {
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 13))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 8))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 13))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 12))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 16))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 5))
  a = u32(a - b)
  a = u32(a - c)
  a = u32(a ^ (c >>> 3))
  b = u32(b - c)
  b = u32(b - a)
  b = u32(b ^ (a << 10))
  c = u32(c - a)
  c = u32(c - b)
  c = u32(c ^ (b >>> 15))
  return c
}

function uintHash(value, hash, prime) {
  const a = u32(prime + u32(value))
  const b = u32(prime)
  return mix(a, b, hash)
}

// A negative small is mixed twice. The second mix uses the two's-complement bits.
function sintHash(value, hash) {
  const y = value | 0
  if (y < 0) hash = uintHash((-y) >>> 0, hash, HCONST)
  return uintHash(y >>> 0, hash, HCONST)
}

export function phash2(values) {
  let hash = uintHash(values.length, 0, HCONST_9)
  for (const value of values) hash = sintHash(value, hash)
  return hash & 0x07ffffff
}

function inside(i, j) {
  const x = i * CELL
  const y = j * CELL
  const cx = Math.floor(x / CHUNK)
  const cy = Math.floor(y / CHUNK)
  if (cx < -14 || cx > 14 || cy < -14 || cy > 14) return false
  return x * x + y * y <= RADIUS * RADIUS
}

function discBiome(seed, attempt, i, j) {
  const x = i * CELL
  const y = j * CELL
  if (x * x + y * y <= KEEP * KEEP) return "meadow"
  const hash = phash2([seed, i, j, attempt])
  const band = hash % 100
  if (band <= 7 && hash % 5 === 0) return "ford"
  if (band <= 7) return "river"
  if (band <= 13) return "cliff"
  if (band <= 39) return "pine"
  if (band <= 51) return "ruins"
  return "meadow"
}

function skirtBiome(seed, attempt, i, j) {
  const band = phash2([seed, i, j, attempt]) % 100
  if (band <= 40) return "pine"
  if (band <= 70) return "cliff"
  if (band <= 88) return "hill"
  return "mountain"
}

export function pictureCell(seed, attempt, x, y) {
  const i = roundAway(x / CELL)
  const j = roundAway(y / CELL)
  if (inside(i, j)) return discBiome(seed, attempt, i, j)
  return skirtBiome(seed, attempt, i, j)
}

function rgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

function biomeRgb(name) {
  if (name === "pine" || name === "river") return rgb(SHADE)
  if (name === "cliff" || name === "ruins") return rgb(ringColor)
  if (name === "hill") return rgb(sunsetColor)
  if (name === "mountain") return rgb(horizonColor)
  return rgb(groundColor)
}

function paintBytes(seed, attempt) {
  const rgba = new Uint8Array(HORIZON_TEX * HORIZON_TEX * 4)
  for (let iy = 0; iy < HORIZON_TEX; iy++) {
    for (let ix = 0; ix < HORIZON_TEX; ix++) {
      const u = (ix + 0.5) / HORIZON_TEX
      const v = (iy + 0.5) / HORIZON_TEX
      const worldX = (u - 0.5) * HORIZON_SPAN
      const worldZ = -((v - 0.5) * HORIZON_SPAN)
      const [r, g, b] = biomeRgb(pictureCell(seed, attempt, worldX, worldZ))
      const o = (iy * HORIZON_TEX + ix) * 4
      rgba[o] = r
      rgba[o + 1] = g
      rgba[o + 2] = b
      rgba[o + 3] = 255
    }
  }
  return rgba
}

function pineGeometry() {
  const w = 7
  const h = 18
  const positions = []
  const push = (x, y, z) => positions.push(x, y, z)
  push(-w, 0, 0)
  push(w, 0, 0)
  push(0, h, 0)
  push(-w, 0, 0)
  push(0, h, 0)
  push(w, 0, 0)
  push(0, 0, -w)
  push(0, 0, w)
  push(0, h, 0)
  push(0, 0, -w)
  push(0, h, 0)
  push(0, 0, w)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return trackGeometry(geometry)
}

function gateGeometry() {
  const positions = []
  const colors = []
  const stone = rgb(ringColor).map((channel) => channel / 255)
  const glow = [1, 1, 1]
  const box = (w, h, d, x, y, z, color) => {
    const source = new THREE.BoxGeometry(w, h, d)
    const pos = source.getAttribute("position")
    const index = source.getIndex()
    for (let i = 0; i < index.count; i++) {
      const v = index.getX(i)
      positions.push(pos.getX(v) + x, pos.getY(v) + y, pos.getZ(v) + z)
      colors.push(color[0], color[1], color[2])
    }
    source.dispose()
  }
  box(8, 32, 8, -14, 16, 0, stone)
  box(8, 32, 8, 14, 16, 0, stone)
  box(36, 8, 8, 0, 32, 0, stone)
  box(16, 20, 4, 0, 16, -2, glow)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return trackGeometry(geometry)
}

function cellRange(origin, reach) {
  const min = roundAway((origin - reach) / CELL) - 1
  const max = roundAway((origin + reach) / CELL) + 1
  return [min, max]
}

export function mountPicture(scene) {
  const bytes = paintBytes(1, 0)
  const map = new THREE.DataTexture(bytes, HORIZON_TEX, HORIZON_TEX)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.NearestFilter
  map.minFilter = THREE.NearestFilter
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
  // The lower 45% of the gameplay frame hits this plane inside about 1.05 spans.
  // Scene fog at 0.9/span pulls misted stone inside the clear color there.
  // This fade starts past that and is the clear color before the far plane.
  const horizonFogNear = { value: 1470 }
  const horizonFogFar = { value: 2800 }
  const material = new THREE.MeshBasicMaterial({ map, color: 0xffffff, fog: false })
  material.customProgramCacheKey = () => "horizon-skirt"
  material.onBeforeCompile = (shader) => {
    shader.uniforms.mistMask = { value: mask }
    shader.uniforms.mistStrength = mistStrength
    shader.uniforms.mistColor = mistColor
    shader.uniforms.horizonFogNear = horizonFogNear
    shader.uniforms.horizonFogFar = horizonFogFar
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vHorizonWorld;")
      .replace(
        "#include <project_vertex>",
        "vHorizonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n\t#include <project_vertex>"
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D mistMask;\nuniform float mistStrength;\nuniform vec3 mistColor;\nuniform float horizonFogNear;\nuniform float horizonFogFar;\nvarying vec3 vHorizonWorld;"
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\n\tvec2 mistUv = (vHorizonWorld.xz / 512.0 + 16.0) / 32.0;\n\tfloat known = texture2D(mistMask, mistUv).r;\n\tdiffuseColor.rgb = mix(mix(diffuseColor.rgb, mistColor, mistStrength), diffuseColor.rgb, known);\n\tfloat fogD = length(vHorizonWorld - cameraPosition);\n\tfloat fogF = smoothstep(horizonFogNear, horizonFogFar, fogD);\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, mistColor, fogF);"
      )
  }

  const horizon = new THREE.Mesh(trackGeometry(new THREE.PlaneGeometry(HORIZON_SPAN, HORIZON_SPAN)), material)
  horizon.rotation.x = -Math.PI / 2
  horizon.position.y = 0.04
  horizon.userData.role = "horizon"
  horizon.frustumCulled = false
  scene.add(horizon)

  const trees = new THREE.InstancedMesh(
    pineGeometry(),
    new THREE.MeshBasicMaterial({ color: SHADE, side: THREE.DoubleSide }),
    TREE_CAP
  )
  trees.count = 0
  trees.frustumCulled = false
  trees.userData.role = "far-pine"
  scene.add(trees)

  const gateMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    emissive: 0xff7a2a
  })
  gateMaterial.customProgramCacheKey = () => "hell-gate"
  gateMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;"
    )
  }
  const gate = new THREE.InstancedMesh(gateGeometry(), gateMaterial, 8)
  gate.count = 0
  gate.frustumCulled = false
  gate.castShadow = false
  gate.receiveShadow = false
  gate.userData.role = "portal"
  scene.add(gate)

  const dummy = new THREE.Object3D()
  let painted = ""
  let mistKey = ""
  let treeKey = ""

  function paint(seed, attempt) {
    const key = `${seed}:${attempt}`
    if (key === painted) return
    painted = key
    map.image.data.set(paintBytes(seed, attempt))
    map.needsUpdate = true
  }

  function mist(snap, seeded) {
    const chunks = seeded ? snap.chunks || [] : []
    const key = seeded ? chunks.map((chunk) => `${chunk.cx},${chunk.cy}`).join("|") : "off"
    mistStrength.value = seeded ? MIST : 0
    mistColor.value.setHex(lightName(snap) === "night" ? 0x322c3c : 0x4e4651)
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
    const [i0, i1] = cellRange(camera.position.x, reach)
    const [j0, j1] = cellRange(camera.position.z, reach)
    const found = []
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = i * CELL
        const z = j * CELL
        if (Math.abs(x) < YARD && Math.abs(z) < YARD) continue
        if (Math.hypot(x - camera.position.x, z - camera.position.z) > reach) continue
        if (pictureCell(seed, attempt, x, z) !== "pine") continue
        found.push({ x, z, hash: phash2([seed, i, j, attempt]) })
      }
    }
    found.sort((a, b) => a.hash - b.hash)
    const picks = found.slice(0, TREE_CAP)
    trees.count = picks.length
    for (let n = 0; n < picks.length; n++) {
      dummy.position.set(picks[n].x, 0, picks[n].z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      trees.setMatrixAt(n, dummy.matrix)
    }
    trees.instanceMatrix.needsUpdate = true
  }

  function placeGates(portals) {
    const rows = (portals || []).slice(0, gate.instanceMatrix.count)
    gate.count = rows.length
    for (let n = 0; n < rows.length; n++) {
      const row = rows[n]
      dummy.position.set(row.x, 0, row.y)
      dummy.rotation.set(0, Math.atan2(row.x, row.y), 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      gate.setMatrixAt(n, dummy.matrix)
    }
    gate.instanceMatrix.needsUpdate = true
  }

  return {
    sync(snap, camera, halfH) {
      const seeded = Number.isInteger(snap && snap.seed)
      const seed = seeded ? snap.seed : 1
      const attempt = seeded ? snap.attempt || 0 : 0
      paint(seed, attempt)
      mist(snap || {}, seeded)
      const span = (halfH || 168) / Math.tan(THREE.MathUtils.degToRad(7.5))
      horizonFogNear.value = span * 1.15
      horizonFogFar.value = span * 2.2
      if (camera) placeTrees(camera, seed, attempt, halfH || 168)
      placeGates(seeded ? snap.portals : [])
    }
  }
}
