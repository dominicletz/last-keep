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

function notImplemented() {
  throw new Error("not implemented")
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
    present: notImplemented
  }
}

export function pictureFromSearch(search) {
  const raw = search && search.startsWith("?") ? search : `?${search || ""}`
  if (new URLSearchParams(raw).get("hd2d") !== "1") return null
  return createHdPicture()
}
