import * as THREE from "three"

// One fullscreen quantize of the internal buffer. Three writes linear light
// into a normal render target, so the shader encodes sRGB (the same curve as
// srgbFromLinearByte) before it picks the nearest locked color. The palette is
// a uniform array: a texture strip sampled inside a 320-step loop stalled the
// software GL and the raise walk never reached the keep. No shadow map.
export function paletteFragmentShader(count) {
  return `
      precision highp float;
      uniform sampler2D tScene;
      uniform vec3 palette[${count}];
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
        float best = 1e9;
        vec3 pick = srgb;
        for (int i = 0; i < ${count}; i++) {
          vec3 d = srgb - palette[i];
          float dist = dot(d, d);
          if (dist < best) {
            best = dist;
            pick = palette[i];
          }
        }
        gl_FragColor = vec4(pick, 1.0);
      }
    `
}

export function createPalettePass(renderer, palette) {
  const colors = palette.map((color) => new THREE.Vector3(color[0] / 255, color[1] / 255, color[2] / 255))
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
      palette: { value: colors },
      resolution: { value: new THREE.Vector2(16, 16) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: paletteFragmentShader(palette.length),
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
