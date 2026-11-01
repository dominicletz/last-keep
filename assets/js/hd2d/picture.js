import * as THREE from "three"
import { cameraLift, frameFor } from "../frame.js"
import { mixPose, PORTRAIT_FOV, portraitPose } from "../portrait.js"
import { SHEET_HEROES, spriteHeight, walkSheetUrl } from "../pictures.js"
import { masonryBytes } from "../tiles.js"
import { tierExtras, tierFor } from "./tier.js"

const LOOK = {
  fov: 15,
  day: { ambient: 0xc8c6c2, ambientLevel: 0.35, sun: 0xfff3e4, sunLevel: 1.1, torch: 0, hemi: 0.4 },
  dusk: { ambient: 0xb0a89c, ambientLevel: 0.22, sun: 0xffb060, sunLevel: 1.4, torch: 1600, hemi: 0.25 },
  night: { ambient: 0x6a6278, ambientLevel: 0.08, sun: 0x000000, sunLevel: 0, torch: 7200, hemi: 0.05 },
  sunDir: [90, 200, 30],
  bloomThreshold: 0.72,
  bloomRadius: 6,
  highlightCap: 0.92,
  focusBand: 0.04,
  fogFloorY: 0,
  fogCeilingY: 36,
  fogMixCap: 0.38,
  litHeroes: 2,
  shadowMap: 512,
  shadowBias: -0.0008
}

// Every hero walk sheet is 8 x 12 cells of 128 px. The hero is 88 px tall with
// the outline, and the lowest outline row is 117 (docs/concepts/SPRITE-PIPELINE.md).
export const SHEET_CELL = 128
export const SHEET_HERO = 88
export const SHEET_FOOT_ROW = 117
// World units per sheet texel when the hero stands spriteHeight tall.
export const SHEET_TEXEL = spriteHeight / SHEET_HERO

// Integer scaling. A texel covers a whole number of screen pixels at the
// card's depth, so nearest sampling never doubles one column and not the next.
// Under half a pixel per texel the card keeps its nominal size and minifies.
export function heroTexel(worldPerPixel, nominal = SHEET_TEXEL) {
  if (!(worldPerPixel > 0)) return nominal
  const k = Math.round(nominal / worldPerPixel)
  return k >= 1 ? k * worldPerPixel : nominal
}

export function sheetCardGeometry() {
  const size = SHEET_CELL * SHEET_TEXEL
  const geometry = new THREE.PlaneGeometry(size, size)
  // The cell bottom sits under the ground so the boot soles touch y = 0.
  geometry.translate(0, size / 2 - (SHEET_CELL - 1 - SHEET_FOOT_ROW) * SHEET_TEXEL, 0)
  return geometry
}

// The hero drawn inside a sheet card, not the whole cell: SHEET_HERO texels
// tall from the soles at y = 0, at the scale snapHeroCard gave the card.
export function sheetHeroSize(plane, picture) {
  const scale = plane.scale.y
  return { w: picture.w * scale, h: SHEET_HERO * SHEET_TEXEL * scale }
}

const snapPos = new THREE.Vector3()
const snapDir = new THREE.Vector3()

// Scale a sheet hero card so one texel is a whole number of pixels for this camera.
export function snapHeroCard(plane, camera, bufferHeight) {
  if (!plane || !camera || !camera.isPerspectiveCamera || !(bufferHeight > 0)) return 1
  plane.getWorldPosition(snapPos)
  camera.getWorldDirection(snapDir)
  const depth = snapPos.sub(camera.position).dot(snapDir)
  if (!(depth > 0)) return 1
  const worldPerPixel = (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / (bufferHeight * (camera.zoom || 1))
  const scale = heroTexel(worldPerPixel) / SHEET_TEXEL
  plane.scale.setScalar(scale)
  return scale
}

// Distance carries the mist. Height only deepens it on the ground, and the ramp starts past the focal plane so the keep and the heroes stay clear.
const FOG = { height: 0.78, near: 1.05, far: 1.42 }
const COC_MAX_PX = 16
const COC_REACH = 0.12
const RESTORE_PX = 0.5
const FLAME = new Set([0xeea821, 0xf5751e])
const LUMA = [0.2126, 0.7152, 0.0722]
const DISK_RING = 15

function glslFloat(value) {
  const text = String(value)
  if (text.includes(".") || text.includes("e") || text.includes("E")) return text
  return `${text}.0`
}

// GLSL smoothstep is undefined when the ceiling is above the floor, so this is that curve with the edges kept in that order.
function hermite(edge0, edge1, x) {
  const width = edge1 - edge0
  const t = width === 0 ? (x >= edge0 ? 1 : 0) : Math.min(1, Math.max(0, (x - edge0) / width))
  return t * t * (3 - 2 * t)
}

export function fogMix(worldY, distance, span) {
  const heightFog = hermite(LOOK.fogCeilingY, LOOK.fogFloorY, worldY)
  const distFog = hermite(span * FOG.near, span * FOG.far, distance)
  const mix = distFog * (1 - FOG.height + FOG.height * heightFog)
  return Math.min(LOOK.fogMixCap, Math.max(0, mix))
}

export function circleOfConfusion(distance, span) {
  if (!(span > 0)) return 0
  const excess = Math.abs(distance - span) - LOOK.focusBand * span
  if (excess <= 0) return 0
  return Math.min(1, excess / (span * COC_REACH)) * COC_MAX_PX
}

export function diskOffsets(radius) {
  if (!(radius > 0)) return [{ x: 0, y: 0 }]
  const points = [{ x: 0, y: 0 }]
  // Golden angle so successive rings do not line up into a cross.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < DISK_RING; i++) {
    // Mid-bin radius keeps the last ring strictly inside the requested radius.
    const reach = Math.sqrt((i + 0.5) / DISK_RING) * radius
    const angle = i * golden
    points.push({ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach })
  }
  return points
}

const PASS_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

function depthGlsl() {
  return `
    vec3 worldFromDepth(vec2 uv, float depth) {
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = inverseProjection * clip;
      view /= view.w;
      return (inverseView * vec4(view.xyz, 1.0)).xyz;
    }
  `
}

function hermiteGlsl() {
  return `
    float hermite(float edge0, float edge1, float x) {
      float width = edge1 - edge0;
      float t = width == 0.0 ? step(edge0, x) : clamp((x - edge0) / width, 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }
  `
}

function cocGlsl() {
  return `
    float cocPixels(float dist, float span) {
      float band = ${glslFloat(LOOK.focusBand)} * span;
      float excess = max(0.0, abs(dist - span) - band);
      float t = span > 0.0 ? min(1.0, excess / (span * ${glslFloat(COC_REACH)})) : 0.0;
      return t * ${glslFloat(COC_MAX_PX)};
    }
  `
}

function fogFragment() {
  return `
    precision highp float;
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 inverseProjection;
    uniform mat4 inverseView;
    uniform vec3 eye;
    uniform vec3 background;
    uniform float span;
    varying vec2 vUv;
    ${hermiteGlsl()}
    ${depthGlsl()}
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      vec3 color = texture2D(tColor, uv).rgb;
      vec3 world = worldFromDepth(uv, texture2D(tDepth, uv).r);
      float dist = distance(world, eye);
      float heightFog = hermite(${glslFloat(LOOK.fogCeilingY)}, ${glslFloat(LOOK.fogFloorY)}, world.y);
      float distFog = hermite(span * ${glslFloat(FOG.near)}, span * ${glslFloat(FOG.far)}, dist);
      float fog = clamp(distFog * (${glslFloat(1 - FOG.height)} + ${glslFloat(FOG.height)} * heightFog), 0.0, ${glslFloat(LOOK.fogMixCap)});
      gl_FragColor = vec4(mix(color, background, fog), 1.0);
    }
  `
}

function bloomDownFragment() {
  const luma = `vec3(${LUMA.map(glslFloat).join(", ")})`
  // Corner taps sit on the diagonal. Divide by sqrt(2) so that diagonal is bloomRadius buffer pixels.
  const corner = glslFloat(LOOK.bloomRadius / Math.SQRT2)
  return `
    precision highp float;
    uniform sampler2D tColor;
    uniform vec2 resolution;
    uniform vec2 fullResolution;
    varying vec2 vUv;
    float luma(vec3 color) {
      return dot(color, ${luma});
    }
    vec3 gated(vec3 color) {
      float l = luma(color);
      // Excess over the threshold is what gets blurred. The base color is added back in the upsample.
      return color * max(l - ${glslFloat(LOOK.bloomThreshold)}, 0.0) / max(l, 1e-4);
    }
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      vec2 o = vec2(${corner}) / fullResolution;
      // The center sample stands in for the 2 by 2 block, so its weight is 4.
      vec3 sum = gated(texture2D(tColor, uv).rgb) * 4.0;
      sum += gated(texture2D(tColor, uv + vec2(-o.x, -o.y)).rgb);
      sum += gated(texture2D(tColor, uv + vec2(o.x, -o.y)).rgb);
      sum += gated(texture2D(tColor, uv + vec2(-o.x, o.y)).rgb);
      sum += gated(texture2D(tColor, uv + vec2(o.x, o.y)).rgb);
      gl_FragColor = vec4(sum / 8.0, 1.0);
    }
  `
}

function bloomUpFragment() {
  const luma = `vec3(${LUMA.map(glslFloat).join(", ")})`
  // Outer taps are two steps of this offset, so they land bloomRadius buffer pixels out.
  const halfRadius = glslFloat(LOOK.bloomRadius / 2)
  return `
    precision highp float;
    uniform sampler2D tColor;
    uniform sampler2D tBloom;
    uniform vec2 resolution;
    varying vec2 vUv;
    float luma(vec3 color) {
      return dot(color, ${luma});
    }
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      vec2 h = vec2(${halfRadius}) / resolution;
      vec3 bloom = texture2D(tBloom, uv + vec2(-2.0 * h.x, 0.0)).rgb;
      bloom += texture2D(tBloom, uv + vec2(-h.x, h.y)).rgb * 2.0;
      bloom += texture2D(tBloom, uv + vec2(0.0, 2.0 * h.y)).rgb;
      bloom += texture2D(tBloom, uv + vec2(h.x, h.y)).rgb * 2.0;
      bloom += texture2D(tBloom, uv + vec2(2.0 * h.x, 0.0)).rgb;
      bloom += texture2D(tBloom, uv + vec2(h.x, -h.y)).rgb * 2.0;
      bloom += texture2D(tBloom, uv + vec2(0.0, -2.0 * h.y)).rgb;
      bloom += texture2D(tBloom, uv + vec2(-h.x, -h.y)).rgb * 2.0;
      bloom /= 12.0;
      vec3 color = texture2D(tColor, uv).rgb + bloom;
      float l = luma(color);
      float cap = ${glslFloat(LOOK.highlightCap)};
      if (l > cap) color *= cap / l;
      gl_FragColor = vec4(color, 1.0);
    }
  `
}

function dofFragment() {
  const disk = diskOffsets(1)
  const taps = disk.map((point) => {
    return `sum += texture2D(tColor, uv + vec2(${glslFloat(point.x)}, ${glslFloat(point.y)}) * radius * texel).rgb;`
  })
  return `
    precision highp float;
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 inverseProjection;
    uniform mat4 inverseView;
    uniform vec3 eye;
    uniform float span;
    varying vec2 vUv;
    ${depthGlsl()}
    ${cocGlsl()}
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      vec2 texel = 1.0 / resolution;
      vec3 world = worldFromDepth(uv, texture2D(tDepth, uv).r);
      float radius = cocPixels(distance(world, eye), span);
      vec3 sum = vec3(0.0);
      ${taps.join("\n      ")}
      gl_FragColor = vec4(sum / ${glslFloat(disk.length)}, 1.0);
    }
  `
}

function restoreFragment() {
  return `
    precision highp float;
    uniform sampler2D tSharp;
    uniform sampler2D tBlur;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform mat4 inverseProjection;
    uniform mat4 inverseView;
    uniform vec3 eye;
    uniform float span;
    varying vec2 vUv;
    ${depthGlsl()}
    ${cocGlsl()}
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      vec3 world = worldFromDepth(uv, texture2D(tDepth, uv).r);
      float radius = cocPixels(distance(world, eye), span);
      vec3 sharp = texture2D(tSharp, uv).rgb;
      vec3 soft = texture2D(tBlur, uv).rgb;
      float blend = smoothstep(${glslFloat(RESTORE_PX)}, 3.0, radius);
      gl_FragColor = vec4(mix(sharp, soft, blend), 1.0);
    }
  `
}

function blitFragment() {
  return `
    precision highp float;
    uniform sampler2D tColor;
    uniform vec2 resolution;
    varying vec2 vUv;
    vec3 toSrgb(vec3 linear) {
      vec3 c = clamp(linear, 0.0, 1.0);
      vec3 low = c * 12.92;
      vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
      return mix(high, low, step(c, vec3(0.0031308)));
    }
    void main() {
      vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / resolution;
      gl_FragColor = vec4(toSrgb(texture2D(tColor, uv).rgb), 1.0);
    }
  `
}

function masonryNormals(rgba, width, height) {
  const out = new Uint8Array(width * height * 4)
  const heightAt = (x, y) => {
    const xx = (x + width) % width
    const yy = (y + height) % height
    const o = (yy * width + xx) * 4
    return (LUMA[0] * rgba[o] + LUMA[1] * rgba[o + 1] + LUMA[2] * rgba[o + 2]) / 255
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * 3.2
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * 3.2
      const z = 1
      const len = Math.hypot(dx, dy, z) || 1
      const o = (y * width + x) * 4
      out[o] = Math.round((-dx / len) * 127.5 + 127.5)
      out[o + 1] = Math.round((-dy / len) * 127.5 + 127.5)
      out[o + 2] = Math.round((z / len) * 127.5 + 127.5)
      out[o + 3] = 255
    }
  }
  return out
}

function passMaterial(fragment, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: PASS_VERTEX,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false
  })
}

function linearTarget(width, height, depthTexture = null, filter = THREE.NearestFilter, type = THREE.HalfFloatType) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    magFilter: filter,
    minFilter: filter,
    generateMipmaps: false,
    depthBuffer: Boolean(depthTexture),
    stencilBuffer: false,
    // A multisampled target resolves color and does not leave a depth texture the later passes can sample.
    samples: 0,
    depthTexture,
    type,
    format: THREE.RGBAFormat,
    colorSpace: THREE.NoColorSpace
  })
  target.texture.colorSpace = THREE.NoColorSpace
  target.texture.generateMipmaps = false
  return target
}

function bottomRay(camera) {
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
  const half = THREE.MathUtils.degToRad(camera.fov) / 2
  return forward.multiplyScalar(Math.cos(half)).addScaledVector(up, -Math.sin(half))
}

// Sheet heroes first, in SHEET_HEROES order, then the voxel-atlas heroes.
function sheetRank(hero) {
  const index = SHEET_HEROES.indexOf(hero)
  return index < 0 ? SHEET_HEROES.length : index
}

function heroOrder(a, b) {
  const rank = sheetRank(a.userData.hero) - sheetRank(b.userData.hero)
  if (rank !== 0) return rank
  return String(a.userData.heroId || "").localeCompare(String(b.userData.heroId || ""))
}

let sharedShadow = null

function softShadowTexture() {
  if (sharedShadow) return sharedShadow
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const center = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.min(1, Math.hypot((x - center) / center, (y - center) / center))
      const falloff = radius >= 1 ? 0 : (1 - radius) * (1 - radius)
      const o = (y * size + x) * 4
      data[o] = 26
      data[o + 1] = 16
      data[o + 2] = 12
      data[o + 3] = Math.round(falloff * 170)
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.NoColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  sharedShadow = map
  return map
}

function shadowQuad() {
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  )
  quad.rotation.x = -Math.PI / 2
  quad.position.y = 0.62
  quad.castShadow = false
  quad.receiveShadow = false
  return quad
}

function softwareRenderer(label) {
  return /SwiftShader|llvmpipe|softpipe|Basic Render/i.test(label)
}

// "gpu" keeps the tier the device asked for. "software" and "hidden" cannot
// spend bloom and depth of field. A missing context stays "unknown" so a
// test double that never opens WebGL still exercises the high path.
function rendererKind(renderer) {
  if (!renderer || typeof renderer.getContext !== "function") return "unknown"
  try {
    const gl = renderer.getContext()
    if (!gl || typeof gl.getExtension !== "function") return "unknown"
    const info = gl.getExtension("WEBGL_debug_renderer_info")
    if (!info) return "hidden"
    const label = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "")
    if (!label) return "hidden"
    return softwareRenderer(label) ? "software" : "gpu"
  } catch (_err) {
    return "hidden"
  }
}

function createHdPicture(env) {
  let tier = tierFor(env)
  let extras = { ...tierExtras(tier) }
  // Bloom is the only pass that needs values above 1. The low picture is the
  // 8-bit frame the screen already shows, and half-float targets are what
  // make a software rasterizer miss the blend window.
  let colorType = tier === "low" ? THREE.UnsignedByteType : THREE.HalfFloatType
  let casting = false
  let driverNoted = false
  const lowFog = new THREE.FogExp2(0x4e4651, 0.0008)
  let slowPaints = 0
  let arriving = false
  let resolveReady = () => {}
  let readySettled = false
  const ready = new Promise((resolve) => {
    resolveReady = resolve
  })
  let opened = false
  let span = 0
  let live = false
  // hero -> { map, normal } for each loaded SHEET_HEROES walk sheet.
  const sheets = new Map()
  const sheetCards = new Set()
  let spot = null
  let torchFill = null
  let masonry = null
  const torchWorld = new THREE.Vector3()
  const cardPos = new THREE.Vector3()
  const drawSize = new THREE.Vector2()
  const inverseProjection = new THREE.Matrix4()
  const inverseView = new THREE.Matrix4()
  const eye = new THREE.Vector3()
  const background = new THREE.Color()
  const spanSlot = { value: 0 }
  const fullSize = new THREE.Vector2(1, 1)
  const halfSize = new THREE.Vector2(1, 1)
  let chain = null
  let passScene = null
  let passCamera = null
  let passQuad = null

  function faceCamera(_renderer, _scene, camera) {
    const parent = this.parent
    if (!parent) return
    parent.getWorldPosition(cardPos)
    this.rotation.x = 0
    this.rotation.z = 0
    // The group yaw is the sim facing. Cancel it so the card turns toward the camera and stays upright.
    this.rotation.y = Math.atan2(camera.position.x - cardPos.x, camera.position.z - cardPos.z) - parent.rotation.y
    this.updateMatrix()
    this.matrixWorld.multiplyMatrices(parent.matrixWorld, this.matrix)
  }

  function aimSpot(scene, torch, intensity) {
    if (!spot) {
      spot = new THREE.SpotLight(0xffa24a, 0, 240, 0.7, 0.45, 2)
      spot.shadow.mapSize.set(extras.shadow, extras.shadow)
      spot.shadow.bias = LOOK.shadowBias
    }
    const parent = torch.parent
    if (spot.parent !== parent) parent.add(spot)
    // The keep point sits against the stone. Park the spot outside the base so the pool reaches the yard and the shadow map is not buried in the wall.
    spot.position.set(torch.position.x + 30, 18, torch.position.z + 30)
    spot.distance = 240
    spot.angle = 0.7
    spot.penumbra = 0.45
    spot.intensity = intensity
    spot.castShadow = intensity > 0
    spot.shadow.camera.near = 4
    spot.shadow.camera.far = 70
    spot.shadow.normalBias = 0.4
    if (!torchFill) {
      torchFill = new THREE.PointLight(0xffa24a, 0, 110, 2)
      torchFill.castShadow = false
    }
    if (torchFill.parent !== parent) parent.add(torchFill)
    torchFill.position.set(torch.position.x + 30, 12, torch.position.z + 30)
    torchFill.intensity = intensity > 0 ? 2800 : 0
    torch.getWorldPosition(torchWorld)
    spot.target.position.set(torchWorld.x + 36, 0, torchWorld.z + 36)
    if (spot.target.parent !== scene) scene.add(spot.target)
  }

  function litGround(mesh) {
    const material = mesh.material
    if (!material || !material.isMeshBasicMaterial) return
    const map = material.map
    if (map) {
      map.magFilter = THREE.NearestFilter
      map.minFilter = THREE.NearestFilter
    }
    mesh.material = new THREE.MeshLambertMaterial({ map, color: material.color })
    // The contact decal is the shadow the yard reads. A full-screen shadow
    // sample on this ground is the paint the runner frame cap is there to catch.
    mesh.receiveShadow = false
    mesh.castShadow = false
    mesh.userData.hd = "ground"
  }

  function litKeep(keep, stoneMat) {
    if (!masonry) {
      const bytes = masonryBytes("day")
      const map = new THREE.DataTexture(bytes.rgba, bytes.w, bytes.h)
      map.colorSpace = THREE.SRGBColorSpace
      map.magFilter = THREE.NearestFilter
      map.minFilter = THREE.NearestFilter
      map.wrapS = THREE.RepeatWrapping
      map.wrapT = THREE.RepeatWrapping
      map.repeat.set(stoneMat.map.repeat.x, stoneMat.map.repeat.y)
      map.needsUpdate = true
      const normals = masonryNormals(bytes.rgba, bytes.w, bytes.h)
      const normalMap = new THREE.DataTexture(normals, bytes.w, bytes.h)
      normalMap.colorSpace = THREE.NoColorSpace
      normalMap.magFilter = THREE.NearestFilter
      normalMap.minFilter = THREE.NearestFilter
      normalMap.wrapS = THREE.RepeatWrapping
      normalMap.wrapT = THREE.RepeatWrapping
      normalMap.repeat.set(stoneMat.map.repeat.x, stoneMat.map.repeat.y)
      normalMap.needsUpdate = true
      masonry = new THREE.MeshStandardMaterial({
        map,
        normalMap,
        normalScale: new THREE.Vector2(2.4, 2.4),
        roughness: 0.84,
        metalness: 0,
        color: 0xffffff
      })
    }
    keep.traverse((child) => {
      if (child.isMesh && child.material === stoneMat) child.material = masonry
    })
    keep.traverse((child) => {
      if (!child.isMesh || child.userData.hdFlame || !child.material || !child.material.isMeshBasicMaterial) return
      const hex = child.material.color && child.material.color.getHex()
      if (!FLAME.has(hex)) return
      const color = new THREE.Color(hex)
      child.material = new THREE.MeshStandardMaterial({
        color: 0x120800,
        emissive: color,
        emissiveIntensity: 8,
        roughness: 1,
        metalness: 0
      })
      const pool = new THREE.PointLight(hex, 2200, 40, 2)
      pool.castShadow = false
      // The yard mesh covers the view. A point light on that mesh is evaluated
      // for every pixel. The flame only needs to light the keep.
      pool.layers.set(1)
      child.add(pool)
      child.userData.hdFlame = true
    })
    keep.traverse((child) => {
      if (!child.isLight) child.layers.enable(1)
    })
  }

  function litHero(group) {
    if (group.userData.hd) return
    const hero = group.userData.hero
    const sheetHero = SHEET_HEROES.includes(hero)
    const sheet = sheetHero ? sheets.get(hero) : null
    if (sheetHero && !sheet) return
    const sprite = group.userData.card
    if (!sprite || !sprite.isSprite) return
    const source = group.userData.picture
    const map = sheet ? sheet.map : sprite.material.map
    if (map) {
      map.magFilter = THREE.NearestFilter
      map.minFilter = THREE.NearestFilter
    }
    if (sheet) {
      map.repeat.set(1 / 8, 1 / 12)
      group.userData.picture = {
        directions: 8,
        frames: 12,
        walk: 8,
        idle: 4,
        attack: 0,
        death: 0,
        w: source.w,
        h: source.h
      }
    }
    let geometry
    if (sheet) {
      geometry = sheetCardGeometry()
    } else {
      geometry = new THREE.PlaneGeometry(source.w, source.h)
      geometry.translate(0, source.h / 2, 0)
    }
    const plane = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({
        map,
        normalMap: sheet ? sheet.normal : null,
        alphaTest: 0.4,
        transparent: true
      })
    )
    plane.castShadow = true
    plane.receiveShadow = false
    plane.onBeforeRender = faceCamera
    group.remove(sprite)
    group.add(plane)
    group.userData.card = plane
    group.userData.hd = sheet ? hero : "lit"
    if (sheet) sheetCards.add(plane)
    for (const child of group.children) {
      if (child.userData.contact) child.visible = false
      if (goldPlate(child)) child.visible = false
    }
    if (!group.userData.hdQuad) {
      const quad = shadowQuad()
      group.add(quad)
      group.userData.hdQuad = quad
    }
  }

  function viewUniforms(depth) {
    return {
      inverseProjection: { value: inverseProjection },
      inverseView: { value: inverseView },
      eye: { value: eye },
      span: spanSlot,
      tDepth: { value: depth },
      resolution: { value: fullSize }
    }
  }

  function buildChain(width, height) {
    const halfW = Math.max(1, width >> 1)
    const halfH = Math.max(1, height >> 1)
    fullSize.set(width, height)
    halfSize.set(halfW, halfH)
    const depth = new THREE.DepthTexture(width, height)
    depth.format = THREE.DepthFormat
    depth.type = THREE.UnsignedIntType
    depth.magFilter = THREE.NearestFilter
    depth.minFilter = THREE.NearestFilter
    const sceneTarget = linearTarget(width, height, depth, THREE.NearestFilter, colorType)
    const fogged = linearTarget(width, height, null, THREE.NearestFilter, colorType)
    // The tent filter interpolates the glow. Scene, graded, and restore stay nearest so the in-focus restore copies texels.
    const bloom = linearTarget(halfW, halfH, null, THREE.LinearFilter, colorType)
    const graded = linearTarget(width, height, null, THREE.NearestFilter, colorType)
    const blurred = linearTarget(width, height, null, THREE.NearestFilter, colorType)
    const shown = linearTarget(width, height, null, THREE.NearestFilter, colorType)
    const view = viewUniforms(depth)
    const fog = passMaterial(fogFragment(), {
      ...view,
      tColor: { value: sceneTarget.texture },
      background: { value: background }
    })
    const bloomDown = passMaterial(bloomDownFragment(), {
      tColor: { value: fogged.texture },
      resolution: { value: halfSize },
      fullResolution: { value: fullSize }
    })
    const bloomUp = passMaterial(bloomUpFragment(), {
      tColor: { value: fogged.texture },
      tBloom: { value: bloom.texture },
      resolution: { value: fullSize }
    })
    const dof = passMaterial(dofFragment(), {
      ...view,
      tColor: { value: graded.texture }
    })
    const restore = passMaterial(restoreFragment(), {
      ...view,
      tSharp: { value: graded.texture },
      tBlur: { value: blurred.texture }
    })
    const blit = passMaterial(blitFragment(), {
      tColor: { value: shown.texture },
      resolution: { value: fullSize }
    })
    passScene = new THREE.Scene()
    passCamera = new THREE.Camera()
    passQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fog)
    passQuad.frustumCulled = false
    passScene.add(passQuad)
    return { width, height, scene: sceneTarget, fogged, bloom, graded, blurred, shown, fog, bloomDown, bloomUp, dof, restore, blit }
  }

  function resizeChain(width, height) {
    const halfW = Math.max(1, width >> 1)
    const halfH = Math.max(1, height >> 1)
    chain.scene.setSize(width, height)
    chain.fogged.setSize(width, height)
    chain.graded.setSize(width, height)
    chain.blurred.setSize(width, height)
    chain.shown.setSize(width, height)
    chain.bloom.setSize(halfW, halfH)
    const depth = chain.scene.depthTexture
    depth.image.width = width
    depth.image.height = height
    fullSize.set(width, height)
    halfSize.set(halfW, halfH)
    chain.width = width
    chain.height = height
  }

  function settleReady() {
    if (readySettled) return
    readySettled = true
    resolveReady()
  }

  function goldPlate(child) {
    return !!(
      child.isMesh &&
      child.material &&
      child.material.color &&
      child.material.color.getHex() === 0xf0c14a &&
      child.position.y > 0 &&
      child.position.y < 2
    )
  }

  function walkTexture(url, colorSpace) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader()
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = colorSpace
          texture.magFilter = THREE.NearestFilter
          texture.minFilter = THREE.NearestFilter
          texture.flipY = true
          texture.wrapS = THREE.ClampToEdgeWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          texture.generateMipmaps = false
          texture.needsUpdate = true
          resolve(texture)
        },
        undefined,
        reject
      )
    })
  }

  // Each sheet is used as soon as it loads. ready waits for all of them, so a
  // graded still never shows a hero on the voxel card by accident.
  function loadWalk() {
    Promise.all(
      SHEET_HEROES.map((hero) =>
        Promise.all([
          walkTexture("/" + walkSheetUrl(hero), THREE.SRGBColorSpace),
          walkTexture("/" + walkSheetUrl(hero, true), THREE.NoColorSpace)
        ]).then(([map, normal]) => {
          sheets.set(hero, { map, normal })
        })
      )
    ).then(settleReady).catch((err) => {
      console.error(err)
    })
  }

  function attachStrip(map, normalMap, hero = "warrior") {
    if (!map || !map.isTexture || !SHEET_HEROES.includes(hero)) throw new Error("strip")
    sheets.set(hero, { map, normal: normalMap && normalMap.isTexture ? normalMap : null })
    settleReady()
  }

  function dropChain() {
    if (!chain) return
    const depth = chain.scene.depthTexture
    if (depth && depth.dispose) depth.dispose()
    for (const key of ["scene", "fogged", "bloom", "graded", "blurred", "shown"]) {
      if (chain[key] && chain[key].dispose) chain[key].dispose()
    }
    chain = null
  }

  function useLowExtras() {
    if (!extras.bloom && !extras.dof && extras.shadow <= 128 && colorType === THREE.UnsignedByteType) return
    tier = "low"
    extras = { ...tierExtras("low") }
    slowPaints = 0
    colorType = THREE.UnsignedByteType
    if (spot) {
      spot.shadow.mapSize.set(extras.shadow, extras.shadow)
      if (spot.shadow.map) {
        spot.shadow.map.dispose()
        spot.shadow.map = null
      }
    }
    dropChain()
  }

  return {
    fov: LOOK.fov,
    get tier() {
      return tier
    },
    get extras() {
      return extras
    },
    ready,
    get live() {
      return live
    },
    attachStrip,
    grade(paint) {
      if (live) throw new Error("grade refuses a live room")
      if (typeof paint !== "function") throw new Error("grade")
      return ready.then(() => paint())
    },
    open(stage) {
      if (opened) throw new Error("open once")
      // A failed constructor still spends the one open.
      opened = true
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false })
      if (typeof document !== "undefined") loadWalk()
      renderer.setPixelRatio(1)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      const camera = new THREE.PerspectiveCamera(LOOK.fov, 1, 1, 4000)
      camera.up.set(0, 1, 0)
      return { renderer, camera }
    },
    fit(renderer, camera, cssW, cssH, rank) {
      const world = frameFor(cssW, cssH, rank)
      const bufferWidth = Math.max(160, Math.round(cssW))
      const bufferHeight = Math.max(160, Math.round(cssH))
      renderer.setPixelRatio(1)
      renderer.setSize(bufferWidth, bufferHeight, false)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      camera.fov = LOOK.fov
      camera.aspect = bufferWidth / bufferHeight
      span = world.halfH / Math.tan(THREE.MathUtils.degToRad(LOOK.fov) / 2)
      camera.near = span * 0.15
      camera.far = span * 2.5
      camera.updateProjectionMatrix()
      return {
        bufferWidth,
        bufferHeight,
        snapHeight: world.bufferHeight,
        aspect: bufferWidth / bufferHeight,
        halfW: world.halfW,
        halfH: world.halfH,
        left: world.left,
        right: world.right,
        top: world.top,
        bottom: world.bottom
      }
    },
    seat(camera, focus, dist, snap, view) {
      if (!snap || !snap.hd2dStill) live = true
      const rise = 0.9 * dist - cameraLift
      const dir = new THREE.Vector3(dist, rise, dist).normalize()
      const look = new THREE.Vector3(focus.x, cameraLift, focus.z)
      const home = look.clone().addScaledVector(dir, span)
      const blend = snap && snap.portrait ? 0 : view && Number.isFinite(view.blend) ? Math.min(1, Math.max(0, view.blend)) : 1
      arriving = blend < 1
      if (blend < 1) {
        const hero = (view && view.hero) || { x: focus.x, z: focus.z }
        const portrait = portraitPose(hero, (view && view.cssW) || 1280, (view && view.cssH) || 800)
        const from = { position: portrait.position, look: portrait.look }
        const to = { position: { x: home.x, y: home.y, z: home.z }, look: { x: look.x, y: look.y, z: look.z } }
        const pose = blend <= 0 ? from : mixPose(from, to, blend)
        const step = Math.min(1, Math.max(0, blend))
        const glide = step * step * (3 - 2 * step)
        camera.fov = PORTRAIT_FOV + (LOOK.fov - PORTRAIT_FOV) * glide
        camera.near = 1
        camera.position.set(pose.position.x, pose.position.y, pose.position.z)
        camera.lookAt(pose.look.x, pose.look.y, pose.look.z)
        camera.updateProjectionMatrix()
      } else {
        camera.position.copy(home)
        camera.lookAt(look)
      }
      camera.updateMatrixWorld()
      const bottom = bottomRay(camera)
      const groundDistance = bottom.y < 0 ? -camera.position.y / bottom.y : Infinity
      if (groundDistance < camera.near * 2) {
        camera.near = Math.max(1, groundDistance * 0.5)
        camera.updateProjectionMatrix()
      }
    },
    light(clock, lights) {
      if (clock !== "day" && clock !== "dusk" && clock !== "night") throw new Error("unknown clock")
      const rig = LOOK[clock]
      const { scene, sun, ambient, hemi, torch } = lights
      scene.background.set(clock === "night" ? 0x322c3c : 0x4e4651)
      if (!extras.bloom && !extras.dof) {
        lowFog.color.copy(scene.background)
        scene.fog = lowFog
      } else scene.fog = null
      hemi.color.set(rig.ambient)
      hemi.groundColor.set(0x3a342c)
      hemi.intensity = rig.hemi
      ambient.color.set(rig.ambient)
      ambient.intensity = rig.ambientLevel
      sun.color.set(rig.sun)
      sun.intensity = rig.sunLevel
      sun.castShadow = false
      sun.position.set(LOOK.sunDir[0], LOOK.sunDir[1], LOOK.sunDir[2]).normalize().multiplyScalar(span)
      sun.target.position.set(0, 0, 0)
      torch.intensity = 0
      torch.castShadow = false
      torch.layers.set(1)
      casting = rig.torch > 0
      aimSpot(scene, torch, rig.torch)
    },
    dress(kit) {
      const grounds = kit && kit.grounds
      if (!kit || !kit.keep || !kit.stoneMat || !Array.isArray(grounds) || grounds.length !== 4 || grounds.some((mesh) => !mesh)) {
        throw new Error("dress kit")
      }
      for (const mesh of grounds) litGround(mesh)
      litKeep(kit.keep, kit.stoneMat)
      const heroes = (Array.isArray(kit.heroes) ? kit.heroes : [])
        .filter((hero) => hero.userData && hero.userData.role === "hero")
        .sort(heroOrder)
      for (const hero of heroes.slice(0, LOOK.litHeroes)) litHero(hero)
    },
    present(renderer, scene, camera) {
      if (sheetCards.size && renderer.getDrawingBufferSize) {
        renderer.getDrawingBufferSize(drawSize)
        for (const plane of sheetCards) {
          if (!plane.parent) sheetCards.delete(plane)
          else snapHeroCard(plane, camera, drawSize.y)
        }
      }
      if (!driverNoted) {
        driverNoted = true
        const kind = rendererKind(renderer)
        // A software rasterizer, or a headless page that hides the GPU name,
        // cannot finish bloom and depth of field inside the 45ms blend window.
        if (kind === "software" || kind === "hidden") useLowExtras()
      }
      // Bloom and depth of field are off, so the post chain is three full-screen
      // passes on top of a shadow map. One scene pass with the exponential fog
      // is the same picture at a cost the wave ceiling can hold.
      if (!extras.bloom && !extras.dof) {
        if (renderer.shadowMap) renderer.shadowMap.enabled = false
        const started = performance.now()
        const previousAutoReset = renderer.info.autoReset
        try {
          renderer.info.autoReset = false
          renderer.info.reset()
          if (scene.background && scene.background.isColor) lowFog.color.copy(scene.background)
          lowFog.density = span > 1 ? 0.9 / span : 0
          if (scene.fog !== lowFog) scene.fog = lowFog
          renderer.setRenderTarget(null)
          renderer.clear(true, true, true)
          renderer.render(scene, camera)
        } finally {
          renderer.info.autoReset = previousAutoReset
        }
        return { submitMs: performance.now() - started }
      }
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = casting
        if (extras.shadow <= 128) renderer.shadowMap.type = THREE.BasicShadowMap
      }
      const started = performance.now()
      const previousAutoReset = renderer.info.autoReset
      try {
        renderer.info.autoReset = false
        // Three clears renderer.info at the start of each render. One reset, then autoReset off, lets publishPerf count every pass in this frame.
        renderer.info.reset()
        const drawPass = (target, material) => {
          passQuad.material = material
          renderer.setRenderTarget(target)
          renderer.render(passScene, passCamera)
        }
        renderer.getSize(drawSize)
        const width = Math.max(1, drawSize.x)
        const height = Math.max(1, drawSize.y)
        if (!chain) chain = buildChain(width, height)
        else if (chain.width !== width || chain.height !== height) resizeChain(width, height)
        camera.updateMatrixWorld()
        camera.updateProjectionMatrix()
        inverseProjection.copy(camera.projectionMatrixInverse)
        inverseView.copy(camera.matrixWorld)
        eye.copy(camera.position)
        spanSlot.value = span
        if (scene.background && scene.background.isColor) background.copy(scene.background)
        else background.setRGB(0, 0, 0)
        renderer.setRenderTarget(chain.scene)
        renderer.clear(true, true, true)
        renderer.render(scene, camera)
        drawPass(chain.fogged, chain.fog)
        if (extras.bloom) {
          drawPass(chain.bloom, chain.bloomDown)
          drawPass(chain.graded, chain.bloomUp)
        }
        const sharp = extras.bloom ? chain.graded.texture : chain.fogged.texture
        if (extras.dof && !arriving) {
          chain.dof.uniforms.tColor.value = sharp
          chain.restore.uniforms.tSharp.value = sharp
          drawPass(chain.blurred, chain.dof)
          drawPass(chain.shown, chain.restore)
          chain.blit.uniforms.tColor.value = chain.shown.texture
        } else {
          chain.blit.uniforms.tColor.value = sharp
        }
        drawPass(null, chain.blit)
      } finally {
        renderer.info.autoReset = previousAutoReset
      }
      const submitMs = performance.now() - started
      // Two slow paints in a row means this device cannot hold bloom and depth of field
      // inside the blend window. The first paint may only be shader compile.
      if (submitMs > 40 && (extras.bloom || extras.dof)) slowPaints += 1
      else slowPaints = 0
      if (slowPaints >= 2) useLowExtras()
      return { submitMs }
    }
  }
}

export function createPicture(env) {
  return createHdPicture(env)
}
