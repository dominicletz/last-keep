import * as THREE from "three"
import { cameraLift, frameFor } from "../frame.js"
import { masonryBytes } from "../tiles.js"

const LOOK = {
  fov: 15,
  day: { ambient: 0xc8c6c2, ambientLevel: 0.35, sun: 0xfff3e4, sunLevel: 1.1, torch: 0, hemi: 0.4 },
  dusk: { ambient: 0xb0a89c, ambientLevel: 0.22, sun: 0xffb060, sunLevel: 1.4, torch: 30, hemi: 0.25 },
  night: { ambient: 0x6a6278, ambientLevel: 0.08, sun: 0x000000, sunLevel: 0, torch: 36, hemi: 0.05 },
  sunDir: [90, 200, 30],
  bloomThreshold: 0.72,
  bloomRadius: 6,
  highlightCap: 0.92,
  focusBand: 0.04,
  fogFloorY: 0,
  fogCeilingY: 36,
  fogMixCap: 0.85,
  litHeroes: 2,
  shadowMap: 512,
  shadowBias: -0.0008
}

const FOG = { height: 0.65, distance: 0.35, near: 0.8, far: 1.6 }
const COC_MAX_PX = 8
const RESTORE_PX = 0.5
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
  return Math.min(LOOK.fogMixCap, Math.max(0, heightFog * FOG.height + distFog * FOG.distance))
}

export function circleOfConfusion(distance, span) {
  if (!(span > 0)) return 0
  const excess = Math.abs(distance - span) - LOOK.focusBand * span
  if (excess <= 0) return 0
  return Math.min(1, excess / span) * COC_MAX_PX
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
      float t = span > 0.0 ? min(1.0, excess / span) : 0.0;
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
      float fog = clamp(heightFog * ${glslFloat(FOG.height)} + distFog * ${glslFloat(FOG.distance)}, 0.0, ${glslFloat(LOOK.fogMixCap)});
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
      gl_FragColor = vec4(radius < ${glslFloat(RESTORE_PX)} ? sharp : soft, 1.0);
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

function passMaterial(fragment, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: PASS_VERTEX,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false
  })
}

function linearTarget(width, height, depthTexture = null, filter = THREE.NearestFilter) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    magFilter: filter,
    minFilter: filter,
    generateMipmaps: false,
    depthBuffer: Boolean(depthTexture),
    stencilBuffer: false,
    // A multisampled target resolves color and does not leave a depth texture the later passes can sample.
    samples: 0,
    depthTexture,
    type: THREE.UnsignedByteType,
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

function heroOrder(a, b) {
  const rank = (a.userData.hero === "warrior" ? 0 : 1) - (b.userData.hero === "warrior" ? 0 : 1)
  if (rank !== 0) return rank
  return String(a.userData.heroId || "").localeCompare(String(b.userData.heroId || ""))
}

function shadowQuad() {
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({
      color: 0x1a100c,
      opacity: 0.55,
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

function createHdPicture() {
  const ready = new Promise(() => {})
  let opened = false
  let span = 0
  let live = false
  let strip = null
  let spot = null
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
      spot = new THREE.SpotLight(0xeea821, 0, 240, 0.7, 0.45)
      spot.shadow.mapSize.set(LOOK.shadowMap, LOOK.shadowMap)
      spot.shadow.bias = LOOK.shadowBias
    }
    const parent = torch.parent
    if (spot.parent !== parent) parent.add(spot)
    spot.position.copy(torch.position)
    spot.distance = 240
    spot.angle = 0.7
    spot.penumbra = 0.45
    spot.intensity = intensity
    spot.castShadow = intensity > 0
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
    mesh.receiveShadow = true
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
      masonry = new THREE.MeshLambertMaterial({ map, color: 0xffffff })
    }
    keep.traverse((child) => {
      if (child.isMesh && child.material === stoneMat) child.material = masonry
    })
  }

  function litHero(group) {
    if (group.userData.hd) return
    const warrior = group.userData.hero === "warrior"
    if (warrior && !strip) return
    const sprite = group.userData.card
    if (!sprite || !sprite.isSprite) return
    const source = group.userData.picture
    const map = warrior ? strip : sprite.material.map
    if (map) {
      map.magFilter = THREE.NearestFilter
      map.minFilter = THREE.NearestFilter
    }
    if (warrior) {
      map.repeat.set(1 / 8, 1 / 4)
      group.userData.picture = {
        directions: 8,
        frames: 4,
        walk: 4,
        attack: 0,
        death: 0,
        w: source.w,
        h: source.h
      }
    }
    const geometry = new THREE.PlaneGeometry(source.w, source.h)
    geometry.translate(0, source.h / 2, 0)
    const plane = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ map, alphaTest: 0.4, transparent: true })
    )
    plane.castShadow = true
    plane.receiveShadow = false
    plane.onBeforeRender = faceCamera
    group.remove(sprite)
    group.add(plane)
    group.userData.card = plane
    group.userData.hd = warrior ? "warrior" : "lit"
    for (const child of group.children) {
      if (child.userData.contact) child.visible = false
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
    const sceneTarget = linearTarget(width, height, depth)
    const fogged = linearTarget(width, height)
    // The tent filter interpolates the glow. Scene, graded, and restore stay nearest so the in-focus restore copies texels.
    const bloom = linearTarget(halfW, halfH, null, THREE.LinearFilter)
    const graded = linearTarget(width, height)
    const blurred = linearTarget(width, height)
    const shown = linearTarget(width, height)
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

  return {
    fov: LOOK.fov,
    ready,
    open(stage) {
      if (opened) throw new Error("open once")
      // A failed constructor still spends the one open.
      opened = true
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false })
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
    seat(camera, focus, dist, snap) {
      if (!snap || !snap.hd2dStill) live = true
      const rise = 0.9 * dist - cameraLift
      const dir = new THREE.Vector3(dist, rise, dist).normalize()
      const look = new THREE.Vector3(focus.x, cameraLift, focus.z)
      camera.position.copy(look).addScaledVector(dir, span)
      camera.lookAt(look)
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
      scene.fog = null
      scene.background.set(clock === "night" ? 0x322c3c : 0x4e4651)
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
        drawPass(chain.bloom, chain.bloomDown)
        drawPass(chain.graded, chain.bloomUp)
        drawPass(chain.blurred, chain.dof)
        drawPass(chain.shown, chain.restore)
        drawPass(null, chain.blit)
      } finally {
        renderer.info.autoReset = previousAutoReset
      }
      return { submitMs: performance.now() - started }
    }
  }
}

export function pictureFromSearch(search) {
  const raw = search && search.startsWith("?") ? search : `?${search || ""}`
  if (new URLSearchParams(raw).get("hd2d") !== "1") return null
  return createHdPicture()
}
