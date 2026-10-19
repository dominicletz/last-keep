import * as THREE from "three"

// One fullscreen quantize of the internal buffer. Three writes linear light
// into a normal render target, so the shader encodes sRGB (the same curve as
// srgbFromLinearByte) before it picks the nearest locked color. A loop over
// the palette, whether a texture strip or a uniform array, stalled software
// GL: the motion track recorded five rows in four seconds. The atlas is one
// lookup. No shadow map.
const LUT_SIZE = 128
const LUT_COLS = 16
const LUT_ROWS = 8

export function buildPaletteAtlas(palette, size = LUT_SIZE) {
  const cols = LUT_COLS
  const rows = LUT_ROWS
  const width = size * cols
  const height = size * rows
  const bytes = new Uint8Array(width * height * 4)
  for (let z = 0; z < size; z++) {
    const tileX = z % cols
    const tileY = (z / cols) | 0
    const b = Math.round(((z + 0.5) / size) * 255)
    for (let y = 0; y < size; y++) {
      const g = Math.round(((y + 0.5) / size) * 255)
      const row = (tileY * size + y) * width
      for (let x = 0; x < size; x++) {
        const r = Math.round(((x + 0.5) / size) * 255)
        let best = palette[0]
        let bestD = Infinity
        for (let i = 0; i < palette.length; i++) {
          const color = palette[i]
          const dr = r - color[0]
          const dg = g - color[1]
          const db = b - color[2]
          const dist = dr * dr + dg * dg + db * db
          if (dist < bestD) {
            bestD = dist
            best = color
          }
        }
        const offset = (row + tileX * size + x) * 4
        bytes[offset] = best[0]
        bytes[offset + 1] = best[1]
        bytes[offset + 2] = best[2]
        bytes[offset + 3] = 255
      }
    }
  }
  return { bytes, width, height, size, cols, rows }
}

export function samplePaletteAtlas(atlas, r, g, b) {
  const { bytes, width, size, cols } = atlas
  const x = Math.min(size - 1, Math.floor((r / 255) * size))
  const y = Math.min(size - 1, Math.floor((g / 255) * size))
  const z = Math.min(size - 1, Math.floor((b / 255) * size))
  const tileX = z % cols
  const tileY = (z / cols) | 0
  const offset = ((tileY * size + y) * width + tileX * size + x) * 4
  return [bytes[offset], bytes[offset + 1], bytes[offset + 2]]
}

export function paletteFragmentShader(size = LUT_SIZE, cols = LUT_COLS, rows = LUT_ROWS) {
  return `
      precision highp float;
      uniform sampler2D tScene;
      uniform sampler2D tLut;
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
        vec3 srgb = toSrgb(texture2D(tScene, uv).rgb);
        float size = ${size}.0;
        float cols = ${cols}.0;
        vec3 cell = floor(min(srgb * size, vec3(size - 1.0)));
        float tileX = mod(cell.z, cols);
        float tileY = floor(cell.z / cols);
        vec2 lutUv = (vec2(tileX, tileY) * size + cell.xy + 0.5) / vec2(size * cols, size * ${rows}.0);
        gl_FragColor = vec4(texture2D(tLut, lutUv).rgb, 1.0);
      }
    `
}

export function createPalettePass(renderer, palette) {
  const atlas = buildPaletteAtlas(palette)
  const lut = new THREE.DataTexture(atlas.bytes, atlas.width, atlas.height, THREE.RGBAFormat)
  lut.magFilter = THREE.NearestFilter
  lut.minFilter = THREE.NearestFilter
  lut.wrapS = THREE.ClampToEdgeWrapping
  lut.wrapT = THREE.ClampToEdgeWrapping
  lut.colorSpace = THREE.NoColorSpace
  lut.flipY = false
  lut.unpackAlignment = 1
  lut.needsUpdate = true

  const target = new THREE.WebGLRenderTarget(16, 16, {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    type: THREE.UnsignedByteType
  })
  target.texture.colorSpace = THREE.NoColorSpace
  target.texture.generateMipmaps = false

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: target.texture },
      tLut: { value: lut },
      resolution: { value: new THREE.Vector2(16, 16) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: paletteFragmentShader(atlas.size, atlas.cols, atlas.rows),
    depthTest: false,
    depthWrite: false
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const passScene = new THREE.Scene()
  passScene.add(quad)
  const passCamera = new THREE.Camera()

  return {
    draw(scene, camera) {
      const size = new THREE.Vector2()
      renderer.getSize(size)
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y)
      material.uniforms.resolution.value.set(size.x, size.y)
      renderer.setRenderTarget(target)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      target.texture.colorSpace = THREE.NoColorSpace
      renderer.render(passScene, passCamera)
    }
  }
}
