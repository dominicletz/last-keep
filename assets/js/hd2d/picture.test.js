import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { pixelStep } from "../art_score.js"
import { cameraLift } from "../frame.js"
import { masonryBytes } from "../tiles.js"
import { circleOfConfusion, diskOffsets, fogMix, pictureFromSearch } from "./picture.js"

const CALLS = ["open", "fit", "seat", "light", "dress", "present"]

test("hd2d is a picture only when the parameter is the string 1", () => {
  assert.equal(pictureFromSearch(""), null)
  assert.equal(pictureFromSearch("?hd2d=true"), null)
  assert.equal(pictureFromSearch("?HD2D=1"), null)
  assert.equal(pictureFromSearch("?name=Ada&hero=warrior"), null)

  const picture = pictureFromSearch("?hd2d=1&name=Ada&hero=warrior")
  assert.equal(picture.fov, 15)
  assert.ok(picture.ready instanceof Promise)
  for (const name of CALLS) assert.equal(typeof picture[name], "function")
})

test("fit and seat hold the palette world on a perspective camera", () => {
  const picture = pictureFromSearch("?hd2d=1&name=Ada&hero=warrior")
  const ready = picture.ready
  const camera = new THREE.PerspectiveCamera()
  const renderer = { setPixelRatio() {}, setSize() {}, domElement: { style: {} } }
  const frame = picture.fit(renderer, camera, 1280, 800, 0)

  assert.equal(frame.bufferWidth, 1280)
  assert.equal(frame.bufferHeight, 800)
  assert.equal(frame.halfH, 168)
  assert.equal(frame.snapHeight, 400)
  assert.equal(pixelStep(frame.halfH, frame.snapHeight), pixelStep(168, 400))
  assert.equal(pixelStep(168, 400), 0.84)
  assert.equal(camera.fov, 15)

  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  picture.seat(camera, { x: 0, z: 0 }, 150, {})
  const look = new THREE.Vector3(0, cameraLift, 0)
  const distance = camera.position.distanceTo(look)
  assert.ok(Math.abs(distance - span) <= 0.01)
  const rise = 0.9 * 150 - cameraLift
  const pitched = new THREE.Vector3(150, rise, 150).normalize()
  assert.ok(camera.position.clone().sub(look).normalize().distanceTo(pitched) <= 0.01)

  // The first call may throw while building the renderer. The second call is the guard.
  try {
    picture.open({})
  } catch (err) {
    assert.notEqual(err.message, "open once")
  }
  assert.throws(() => picture.open({}), { message: "open once" })
  assert.equal(picture.ready, ready)
})

function lightRig() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  scene.fog = new THREE.Fog(0x112233, 10, 40)
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.castShadow = true
  scene.add(sun)
  scene.add(sun.target)
  const ambient = new THREE.AmbientLight(0xffffff, 3)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 2)
  scene.add(ambient, hemi)
  const torch = new THREE.PointLight(0xffaa00, 8, 220)
  torch.castShadow = true
  torch.position.set(22, 40, 22)
  const keep = new THREE.Group()
  keep.add(torch)
  scene.add(keep)
  return { scene, sun, ambient, hemi, torch, keep }
}

function spotLights(root) {
  const found = []
  root.traverse((child) => {
    if (child.isSpotLight) found.push(child)
  })
  return found
}

test("light follows the day, dusk, and night clock", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const renderer = { setPixelRatio() {}, setSize() {}, domElement: { style: {} } }
  const camera = new THREE.PerspectiveCamera()
  picture.fit(renderer, camera, 1280, 800, 0)
  const rig = lightRig()
  const { scene, sun, ambient, torch, keep } = rig

  picture.light("day", rig)
  assert.equal(sun.color.getHex(), 0xfff3e4)
  assert.equal(scene.fog, null)
  assert.equal(sun.castShadow, false)
  assert.equal(ambient.color.getHex(), 0xc8c6c2)
  assert.equal(ambient.intensity, 0.35)
  assert.ok(ambient.intensity < sun.intensity)
  assert.equal(torch.intensity, 0)
  assert.equal(torch.castShadow, false)
  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  const expected = new THREE.Vector3(90, 200, 30).normalize().multiplyScalar(span)
  assert.ok(sun.position.distanceTo(expected) < 1e-6)
  assert.equal(sun.target.position.lengthSq(), 0)
  let spots = spotLights(scene)
  assert.equal(spots.length, 1)
  assert.equal(spots[0].parent, torch.parent)
  assert.equal(spots[0].castShadow, false)

  picture.light("dusk", rig)
  assert.equal(sun.color.getHex(), 0xffb060)
  assert.equal(sun.intensity, 1.4)
  assert.equal(scene.fog, null)

  picture.light("night", rig)
  assert.equal(sun.intensity, 0)
  assert.equal(sun.castShadow, false)
  spots = spotLights(scene)
  assert.equal(spots.length, 1)
  assert.equal(spots[0].castShadow, true)
  assert.equal(spots[0].angle, 0.7)
  assert.equal(spots[0].penumbra, 0.45)
  assert.equal(spots[0].distance, 240)
  assert.equal(spots[0].shadow.mapSize.x, 512)
  assert.equal(spots[0].shadow.mapSize.y, 512)
  assert.equal(spots[0].shadow.bias, -0.0008)
  assert.equal(spots[0].target.parent, scene)
  assert.equal(keep.children.includes(spots[0].target), false)
  assert.equal(spots[0].target.position.x, 22 + 36)
  assert.equal(spots[0].target.position.y, 0)
  assert.equal(spots[0].target.position.z, 22 + 36)
  const target = spots[0].target

  picture.light("night", rig)
  assert.equal(spotLights(scene).length, 1)
  assert.equal(spotLights(torch.parent).length, 1)
  assert.equal(spotLights(scene)[0].target, target)

  const rebuilt = new THREE.Group()
  rebuilt.add(torch)
  scene.add(rebuilt)
  picture.light("night", rig)
  assert.equal(spotLights(scene).length, 1)
  assert.equal(spotLights(rebuilt).length, 1)
  assert.equal(spotLights(keep).length, 0)
  assert.equal(torch.intensity, 0)
  assert.equal(torch.castShadow, false)

  assert.throws(() => picture.light("noon", rig), /unknown clock/)
})

function stoneAndGrounds() {
  const map = new THREE.DataTexture(new Uint8Array([90, 80, 70, 255]), 1, 1)
  map.repeat.set(2, 4)
  const stoneMat = new THREE.MeshBasicMaterial({ map, color: 0xffffff })
  const stone = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), stoneMat)
  const other = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), stoneMat)
  const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xeea821 }))
  const keep = new THREE.Group()
  keep.scale.set(1, 0.8, 1)
  keep.add(stone, other, flame)
  const floors = []
  for (let i = 0; i < 4; i++) {
    const groundMap = new THREE.DataTexture(new Uint8Array([20, 80, 30, 255]), 1, 1)
    groundMap.magFilter = THREE.LinearFilter
    groundMap.minFilter = THREE.LinearFilter
    floors.push(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: groundMap, color: 0xffffff })))
  }
  return { stoneMat, stone, other, flame, keep, floors, map }
}

function heroGroup(hero, id) {
  const map = new THREE.DataTexture(new Uint8Array([40, 50, 60, 255]), 1, 1)
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearFilter
  map.repeat.set(1 / 8, 1 / 11)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.4 }))
  const group = new THREE.Group()
  group.add(sprite)
  group.userData.role = "hero"
  group.userData.hero = hero
  group.userData.heroId = id
  group.userData.card = sprite
  group.userData.picture = { directions: 8, frames: 11, walk: 4, attack: 3, death: 4, w: 10, h: 20 }
  return { group, sprite, map }
}

function meshCount(root) {
  let count = 0
  root.traverse((child) => {
    if (child.isMesh) count += 1
  })
  return count
}

test("dress replaces stone with one lambert map and leaves the basic material", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const { stoneMat, stone, other, flame, keep, floors, map } = stoneAndGrounds()
  const day = masonryBytes("day")
  const groundMap = floors[0].material.map
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [] })

  assert.equal(stone.material.isMeshLambertMaterial, true)
  assert.notEqual(stone.material, stoneMat)
  assert.equal(stone.material, other.material)
  assert.equal(stoneMat.isMeshBasicMaterial, true)
  assert.equal(stoneMat.map, map)
  assert.equal(flame.material.isMeshBasicMaterial, true)
  assert.notEqual(flame.material, stone.material)
  assert.equal(keep.scale.y, 0.8)
  assert.equal(stone.material.map.image.width, day.w)
  assert.equal(stone.material.map.image.height, day.h)
  assert.deepEqual(stone.material.map.image.data, day.rgba)
  assert.equal(stone.material.map.repeat.x, 2)
  assert.equal(stone.material.map.repeat.y, 4)
  stone.material.map.repeat.x = 9
  assert.equal(stoneMat.map.repeat.x, 2)
  stone.material.map.repeat.x = 2

  assert.equal(floors[0].material.isMeshLambertMaterial, true)
  assert.equal(floors[0].material.map, groundMap)
  assert.equal(groundMap.magFilter, THREE.NearestFilter)
  assert.equal(groundMap.minFilter, THREE.NearestFilter)
  assert.equal(floors[0].receiveShadow, true)
  assert.equal(floors[0].castShadow, false)

  const litStone = stone.material
  const litGround = floors[0].material
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [] })
  assert.equal(stone.material, litStone)
  assert.equal(floors[0].material, litGround)
})

test("dress turns a mage sprite into one card and does not add another", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const mage = heroGroup("mage", "still-mage")
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4, 8), new THREE.MeshBasicMaterial({ color: 0x140c0a }))
  const discMat = disc.material
  disc.userData.contact = true
  mage.group.add(disc)
  const kit = { grounds: floors, keep, stoneMat, heroes: [mage.group] }

  picture.dress(kit)
  assert.equal(mage.group.children.includes(mage.sprite), false)
  const card = mage.group.userData.card
  assert.equal(card.isMesh, true)
  assert.equal(card.material.map, mage.map)
  assert.ok(card.material.map.offset)
  assert.equal(card.material.map.offset.isVector2, true)
  assert.equal(card.material.map.repeat.x, 1 / 8)
  assert.equal(card.material.map.repeat.y, 1 / 11)
  assert.equal(card.material.map.magFilter, THREE.NearestFilter)
  assert.equal(mage.group.userData.picture.frames, 11)
  assert.equal(card.material.isMeshLambertMaterial, true)
  assert.equal(card.material.alphaTest, 0.4)
  assert.equal(card.material.transparent, true)
  assert.equal(card.castShadow, true)
  card.geometry.computeBoundingBox()
  assert.ok(Math.abs(card.geometry.boundingBox.min.y) < 1e-6)
  assert.equal(disc.visible, false)
  assert.equal(disc.material, discMat)
  const quads = mage.group.children.filter((child) => child.isMesh && child.position.y === 0.62)
  assert.equal(quads.length, 1)
  assert.equal(quads[0].castShadow, false)
  assert.equal(quads[0].receiveShadow, false)
  assert.equal(quads[0].material.depthWrite, false)
  assert.equal(quads[0].material.transparent, true)
  assert.equal(quads[0].geometry.parameters.width, 14)
  assert.equal(quads[0].geometry.parameters.height, 8)
  assert.equal(quads[0].rotation.x, -Math.PI / 2)

  mage.group.rotation.y = Math.PI / 2
  mage.group.position.set(5, 0, 7)
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(105, 30, 7)
  card.onBeforeRender(null, null, camera)
  const ahead = new THREE.Vector3(0, 0, 1).transformDirection(card.matrixWorld)
  const up = new THREE.Vector3(0, 1, 0).transformDirection(card.matrixWorld)
  assert.ok(ahead.x > 0.99)
  assert.ok(Math.abs(ahead.y) < 1e-4)
  assert.ok(up.y > 0.99)

  const meshes = meshCount(mage.group)
  picture.dress(kit)
  assert.equal(meshCount(mage.group), meshes)
  assert.equal(mage.group.children.filter((child) => child.isMesh && child.position.y === 0.62).length, 1)
  assert.equal(mage.group.userData.card, card)
})

test("dress leaves a warrior sprite until a walk strip is loaded", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const { stoneMat, stone, keep, floors } = stoneAndGrounds()
  const warrior = heroGroup("warrior", "still-warrior")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [warrior.group] })
  assert.equal(warrior.group.children.includes(warrior.sprite), true)
  assert.equal(warrior.group.userData.card, warrior.sprite)
  assert.equal(warrior.group.userData.hd, undefined)
  assert.equal(warrior.group.children.length, 1)
  assert.equal(stone.material.isMeshLambertMaterial, true)
  assert.notEqual(stone.material, stoneMat)
})

test("dress leaves the hero outside the cap of two as a sprite", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const warrior = heroGroup("warrior", "z")
  const mage = heroGroup("mage", "m")
  const scout = heroGroup("scout", "s")
  picture.dress({
    grounds: floors,
    keep,
    stoneMat,
    heroes: [scout.group, warrior.group, mage.group]
  })
  assert.equal(warrior.group.userData.card.isSprite, true)
  assert.equal(mage.group.userData.card.isMesh, true)
  assert.equal(scout.group.children.includes(scout.sprite), true)
  assert.equal(scout.group.userData.card.isSprite, true)
})

test("dress without a keep throws", () => {
  const picture = pictureFromSearch("?hd2d=1")
  const stoneMat = new THREE.MeshBasicMaterial()
  const grounds = [new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh()]
  const keep = new THREE.Group()
  assert.throws(() => picture.dress({ grounds, stoneMat, heroes: [] }), /dress kit/)
  assert.throws(() => picture.dress({ grounds: grounds.slice(0, 3), keep, stoneMat }), /dress kit/)
  assert.throws(() => picture.dress({ grounds, keep, heroes: [] }), /dress kit/)
  assert.throws(() => picture.dress({ grounds: [grounds[0], null, grounds[2], grounds[3]], keep, stoneMat }), /dress kit/)
})

test("height fog is stronger on the floor than at the ceiling", () => {
  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  const distances = [0, span * 0.5, span, span * 1.2, span * 4]
  for (const distance of distances) {
    const ceiling = fogMix(36, distance, span)
    const floor = fogMix(0, distance, span)
    assert.ok(ceiling < floor)
    assert.ok(ceiling <= 0.85)
    assert.ok(floor <= 0.85)
  }
  assert.equal(fogMix(0, span * 4, span), 0.85)
})

test("the circle of confusion is zero at the focus distance", () => {
  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  assert.equal(circleOfConfusion(span, span), 0)
  const farther = span * (1 + 0.04) + 1
  const nearer = span * (1 - 0.04) - 1
  assert.ok(circleOfConfusion(farther, span) > 0)
  assert.ok(circleOfConfusion(nearer, span) > 0)
  assert.ok(circleOfConfusion(span * 10, span) <= 8)
  assert.ok(circleOfConfusion(span * 10, span) > circleOfConfusion(farther, span))
})

test("disk offsets stay inside the requested radius", () => {
  const origin = diskOffsets(0)
  assert.equal(origin.length, 1)
  assert.equal(origin[0].x, 0)
  assert.equal(origin[0].y, 0)
  for (const radius of [1, 6, 8]) {
    const samples = diskOffsets(radius)
    assert.ok(samples.length > 1)
    let farthest = 0
    for (const sample of samples) {
      const reach = Math.hypot(sample.x, sample.y)
      assert.ok(reach <= radius)
      if (reach > farthest) farthest = reach
    }
    assert.ok(farthest > radius * 0.5)
  }
  const unit = diskOffsets(1)
  const scaled = diskOffsets(4)
  assert.equal(scaled.length, unit.length)
  for (let i = 0; i < unit.length; i++) {
    assert.ok(Math.abs(scaled[i].x - unit[i].x * 4) <= 1e-9)
    assert.ok(Math.abs(scaled[i].y - unit[i].y * 4) <= 1e-9)
  }
})

test("present submits the frame and reuses its targets", () => {
  const picture = pictureFromSearch("?hd2d=1")
  assert.equal(typeof picture.present, "function")
  const info = { autoReset: true, reset() {} }
  let width = 320
  let height = 200
  let bound = null
  let sawOffscreen = false
  let blitted = false
  let autoResetDuringRender = null
  const used = []
  const renderer = {
    info,
    getSize(out) {
      out.x = width
      out.y = height
    },
    setRenderTarget(target) {
      bound = target
    },
    clear() {},
    render() {
      autoResetDuringRender = info.autoReset
      if (bound) {
        sawOffscreen = true
        used[used.length - 1].add(bound)
      }
      if (bound === null && sawOffscreen) blitted = true
    }
  }
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x4e4651)
  scene.fog = new THREE.Fog(0x112233, 10, 40)
  const fog = scene.fog
  const camera = new THREE.PerspectiveCamera()

  used.push(new Set())
  const first = picture.present(renderer, scene, camera)
  used.push(new Set())
  const second = picture.present(renderer, scene, camera)
  width = 480
  height = 300
  used.push(new Set())
  const resized = picture.present(renderer, scene, camera)

  assert.equal(typeof first.submitMs, "number")
  assert.equal(Number.isFinite(first.submitMs), true)
  assert.ok(first.submitMs >= 0)
  assert.equal(typeof second.submitMs, "number")
  assert.equal(typeof resized.submitMs, "number")
  assert.equal(autoResetDuringRender, false)
  assert.equal(info.autoReset, true)
  assert.equal(blitted, true)
  assert.equal(sawOffscreen, true)
  assert.equal(scene.fog, fog)
  assert.ok(used[0].size > 0)
  for (const target of used[1]) assert.equal(used[0].has(target), true)
  assert.equal(used[1].size, used[0].size)
  for (const target of used[2]) assert.equal(used[0].has(target), true)
  assert.equal(used[2].size, used[0].size)
})
