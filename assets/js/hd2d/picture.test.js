import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { pixelStep } from "../art_score.js"
import { cameraLift } from "../frame.js"
import { masonryBytes } from "../tiles.js"
import {
  circleOfConfusion,
  createPicture,
  diskOffsets,
  fogMix,
  heroTexel,
  snapHeroCard,
  SHEET_CELL,
  SHEET_FOOT_ROW,
  SHEET_HERO,
  SHEET_TEXEL,
  sheetCardGeometry
} from "./picture.js"
import { spriteHeight } from "../pictures.js"

const CALLS = ["open", "fit", "seat", "light", "dress", "present"]

test("every room gets one hd2d picture", () => {
  const picture = createPicture()
  assert.equal(picture.fov, 15)
  assert.equal(picture.tier, "high")
  assert.equal(picture.extras.dof, true)
  assert.equal(picture.extras.bloom, true)
  assert.equal(picture.extras.shadow, 512)
  assert.ok(picture.ready instanceof Promise)
  for (const name of CALLS) assert.equal(typeof picture[name], "function")

  const phone = createPicture({ maxTouchPoints: 2, coarse: true, width: 844, height: 390, hardwareConcurrency: 8, deviceMemory: 8 })
  assert.equal(phone.tier, "phone")
  assert.equal(phone.extras.dof, false)
  assert.equal(phone.extras.bloom, true)
  assert.equal(phone.fov, 15)

  const low = createPicture({ hardwareConcurrency: 2, width: 1280, height: 800 })
  assert.equal(low.tier, "low")
  assert.equal(low.extras.bloom, false)
  assert.equal(low.extras.dof, false)
  assert.equal(low.extras.shadow, 128)

  const ignored = createPicture({ hd2d: "0", perf: "1", width: 1280, height: 800, hardwareConcurrency: 8, deviceMemory: 8 })
  assert.equal(ignored.tier, "high")
  assert.equal(ignored.fov, 15)
})

test("fit and seat hold the palette world on a perspective camera", () => {
  const picture = createPicture()
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
  const picture = createPicture()
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

test("dress lights the keep with a normal map and emissive windows", () => {
  const picture = createPicture()
  const { stoneMat, stone, other, flame, keep, floors, map } = stoneAndGrounds()
  const day = masonryBytes("day")
  const groundMap = floors[0].material.map
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [] })

  assert.equal(stone.material.isMeshStandardMaterial, true)
  assert.ok(stone.material.normalMap)
  assert.equal(stone.material.normalMap.image.width, day.w)
  assert.equal(stone.material.normalMap.image.height, day.h)
  assert.equal(stone.material.map.magFilter, THREE.NearestFilter)
  assert.equal(stone.material.map.minFilter, THREE.NearestFilter)
  assert.equal(stone.material.normalMap.magFilter, THREE.NearestFilter)
  assert.equal(stone.material.normalMap.minFilter, THREE.NearestFilter)
  assert.notEqual(stone.material, stoneMat)
  assert.equal(stone.material, other.material)
  assert.equal(stoneMat.isMeshBasicMaterial, true)
  assert.equal(stoneMat.map, map)
  assert.equal(flame.material.isMeshStandardMaterial, true)
  assert.ok(flame.material.emissiveIntensity > 1)
  assert.equal(flame.material.emissive.getHex(), 0xeea821)
  assert.equal(flame.children.filter((child) => child.isPointLight).length, 1)
  const pool = flame.children.find((child) => child.isPointLight)
  assert.equal(pool.layers.test(stone.layers), true)
  assert.equal(pool.layers.test(floors[0].layers), false)
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
  assert.equal(floors[0].receiveShadow, false)
  assert.equal(floors[0].castShadow, false)

  const litStone = stone.material
  const litGround = floors[0].material
  const flameLights = flame.children.length
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [] })
  assert.equal(stone.material, litStone)
  assert.equal(floors[0].material, litGround)
  assert.equal(flame.children.length, flameLights)
})

test("dress turns a scout sprite into one card and does not add another", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const scout = heroGroup("scout", "still-scout")
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4, 8), new THREE.MeshBasicMaterial({ color: 0x140c0a }))
  const discMat = disc.material
  disc.userData.contact = true
  scout.group.add(disc)
  const kit = { grounds: floors, keep, stoneMat, heroes: [scout.group] }

  picture.dress(kit)
  assert.equal(scout.group.children.includes(scout.sprite), false)
  const card = scout.group.userData.card
  assert.equal(card.isMesh, true)
  assert.equal(card.material.map, scout.map)
  assert.ok(card.material.map.offset)
  assert.equal(card.material.map.offset.isVector2, true)
  assert.equal(card.material.map.repeat.x, 1 / 8)
  assert.equal(card.material.map.repeat.y, 1 / 11)
  assert.equal(card.material.map.magFilter, THREE.NearestFilter)
  assert.equal(scout.group.userData.picture.frames, 11)
  assert.equal(card.material.isMeshLambertMaterial, true)
  assert.equal(card.material.alphaTest, 0.4)
  assert.equal(card.material.transparent, true)
  assert.equal(card.castShadow, true)
  card.geometry.computeBoundingBox()
  assert.ok(Math.abs(card.geometry.boundingBox.min.y) < 1e-6)
  assert.equal(disc.visible, false)
  assert.equal(disc.material, discMat)
  const quads = scout.group.children.filter((child) => child.isMesh && child.position.y === 0.62)
  assert.equal(quads.length, 1)
  assert.equal(quads[0].castShadow, false)
  assert.equal(quads[0].receiveShadow, false)
  assert.equal(quads[0].material.depthWrite, false)
  assert.equal(quads[0].material.transparent, true)
  assert.equal(quads[0].geometry.parameters.width, 14)
  assert.equal(quads[0].geometry.parameters.height, 8)
  assert.equal(quads[0].rotation.x, -Math.PI / 2)
  const shadow = quads[0].material.map
  assert.ok(shadow)
  const side = shadow.image.width
  const center = ((side >> 1) * side + (side >> 1)) * 4 + 3
  assert.ok(shadow.image.data[center] > shadow.image.data[3])

  scout.group.rotation.y = Math.PI / 2
  scout.group.position.set(5, 0, 7)
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(105, 30, 7)
  card.onBeforeRender(null, null, camera)
  const ahead = new THREE.Vector3(0, 0, 1).transformDirection(card.matrixWorld)
  const up = new THREE.Vector3(0, 1, 0).transformDirection(card.matrixWorld)
  assert.ok(ahead.x > 0.99)
  assert.ok(Math.abs(ahead.y) < 1e-4)
  assert.ok(up.y > 0.99)

  const meshes = meshCount(scout.group)
  picture.dress(kit)
  assert.equal(meshCount(scout.group), meshes)
  assert.equal(scout.group.children.filter((child) => child.isMesh && child.position.y === 0.62).length, 1)
  assert.equal(scout.group.userData.card, card)
})

test("dress leaves a warrior sprite until a walk strip is loaded", () => {
  const picture = createPicture()
  const { stoneMat, stone, keep, floors } = stoneAndGrounds()
  const warrior = heroGroup("warrior", "still-warrior")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [warrior.group] })
  assert.equal(warrior.group.children.includes(warrior.sprite), true)
  assert.equal(warrior.group.userData.card, warrior.sprite)
  assert.equal(warrior.group.userData.hd, undefined)
  assert.equal(warrior.group.children.length, 1)
  assert.equal(stone.material.isMeshStandardMaterial, true)
  assert.ok(stone.material.normalMap)
  assert.notEqual(stone.material, stoneMat)
})

test("dress paints the warrior from the walk strip and hides the gold plate", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const warrior = heroGroup("warrior", "still-warrior")
  const gold = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4), new THREE.MeshBasicMaterial({ color: 0xf0c14a }))
  gold.position.y = 0.6
  warrior.group.add(gold)
  const map = new THREE.DataTexture(new Uint8Array([180, 176, 170, 255]), 1, 1)
  const normal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1)
  picture.attachStrip(map, normal)
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [warrior.group] })
  const card = warrior.group.userData.card
  assert.equal(card.isMesh, true)
  assert.equal(card.material.map, map)
  assert.equal(card.material.normalMap, normal)
  assert.equal(card.castShadow, true)
  assert.equal(gold.visible, false)
  const quad = warrior.group.children.find((child) => child.isMesh && child.position.y === 0.62)
  assert.ok(quad.material.map)
  assert.equal(quad.castShadow, false)
})

test("dress paints the mage from its own walk sheet, not the warrior's", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const mage = heroGroup("mage", "still-mage")
  const warrior = heroGroup("warrior", "still-warrior")
  const warriorMap = new THREE.DataTexture(new Uint8Array([180, 176, 170, 255]), 1, 1)
  const mageMap = new THREE.DataTexture(new Uint8Array([44, 70, 98, 255]), 1, 1)
  const mageNormal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1)
  picture.attachStrip(warriorMap, null, "warrior")
  picture.attachStrip(mageMap, mageNormal, "mage")
  assert.throws(() => picture.attachStrip(mageMap, null, "scout"), /strip/)
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [mage.group, warrior.group] })
  const card = mage.group.userData.card
  assert.equal(card.isMesh, true)
  assert.equal(card.material.map, mageMap)
  assert.equal(card.material.normalMap, mageNormal)
  assert.equal(mage.group.userData.hd, "mage")
  assert.equal(warrior.group.userData.card.material.map, warriorMap)
  assert.equal(warrior.group.userData.hd, "warrior")
  // Same sheet layout as the warrior: 8 directions, 8 walk and 4 idle rows.
  assert.equal(mageMap.repeat.x, 1 / 8)
  assert.equal(mageMap.repeat.y, 1 / 12)
  assert.deepEqual(
    { ...mage.group.userData.picture, w: 0, h: 0 },
    { directions: 8, frames: 12, walk: 8, idle: 4, attack: 0, death: 0, w: 0, h: 0 }
  )
  card.geometry.computeBoundingBox()
  const size = SHEET_CELL * SHEET_TEXEL
  assert.ok(Math.abs(card.geometry.boundingBox.max.y - card.geometry.boundingBox.min.y - size) < 1e-4)
  // Mage cards snap to whole screen pixels like the warrior's.
  const camera = new THREE.PerspectiveCamera(15, 1.6, 1, 4000)
  camera.position.set(0, 0, 900)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const scene = new THREE.Scene()
  scene.add(mage.group)
  mage.group.updateMatrixWorld()
  // The snap runs before present reaches the render chain; stop it there.
  const renderer = {
    getDrawingBufferSize: (v) => v.set(1280, 800),
    get info() {
      throw new Error("past the snap")
    }
  }
  assert.throws(() => picture.present(renderer, scene, camera), /past the snap/)
  const worldPerPixel = (2 * 900 * Math.tan(THREE.MathUtils.degToRad(7.5))) / 800
  const pixels = (SHEET_TEXEL * card.scale.x) / worldPerPixel
  assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${pixels} px per texel`)
})

test("the warrior card is a square 128 px cell with the boots on the ground", () => {
  const geometry = sheetCardGeometry()
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const size = SHEET_CELL * SHEET_TEXEL
  // Geometry positions are float32.
  assert.ok(Math.abs(box.max.x - box.min.x - size) < 1e-4)
  assert.ok(Math.abs(box.max.y - box.min.y - size) < 1e-4)
  assert.ok(Math.abs(SHEET_HERO * SHEET_TEXEL - spriteHeight) < 1e-9)
  // The lowest outline row ends exactly at y = 0.
  const soles = box.max.y - (SHEET_FOOT_ROW + 1) * SHEET_TEXEL
  assert.ok(Math.abs(soles) < 1e-4, `soles at ${soles}`)
})

test("hero texels land on a whole number of screen pixels", () => {
  for (const worldPerPixel of [0.05, 0.1, 0.19, 0.25, 0.3, 0.42, 0.6]) {
    const texel = heroTexel(worldPerPixel)
    const pixels = texel / worldPerPixel
    assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${pixels} px per texel`)
    assert.ok(Math.round(pixels) >= 1)
    assert.ok(Math.abs(texel - SHEET_TEXEL) <= worldPerPixel / 2 + 1e-9)
  }
  // Under half a pixel per texel the card minifies at its nominal size.
  assert.equal(heroTexel(SHEET_TEXEL * 3), SHEET_TEXEL)
  assert.equal(heroTexel(0), SHEET_TEXEL)
  assert.equal(heroTexel(Number.NaN), SHEET_TEXEL)
})

test("snapHeroCard scales the card to integer pixels for the camera that draws it", () => {
  const camera = new THREE.PerspectiveCamera(15, 1.6, 1, 4000)
  camera.position.set(0, 0, 900)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const plane = new THREE.Mesh(sheetCardGeometry(), new THREE.MeshBasicMaterial())
  plane.updateMatrixWorld()
  const height = 800
  const scale = snapHeroCard(plane, camera, height)
  const worldPerPixel = (2 * 900 * Math.tan(THREE.MathUtils.degToRad(7.5))) / height
  const pixels = (SHEET_TEXEL * scale) / worldPerPixel
  assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${pixels} px per texel`)
  assert.equal(plane.scale.x, scale)
  assert.equal(plane.scale.y, scale)
  const ortho = new THREE.OrthographicCamera()
  assert.equal(snapHeroCard(plane, ortho, height), 1)
  assert.equal(snapHeroCard(plane, camera, 0), 1)
})

test("grade refuses a live room before the strip resolves", () => {
  const picture = createPicture()
  const camera = new THREE.PerspectiveCamera()
  const renderer = { setPixelRatio() {}, setSize() {}, domElement: { style: {} } }
  picture.fit(renderer, camera, 1280, 800, 0)
  assert.equal(picture.live, false)
  picture.seat(camera, { x: 0, z: 0 }, 150, { hd2dStill: true })
  assert.equal(picture.live, false)
  picture.seat(camera, { x: 0, z: 0 }, 150, {})
  assert.equal(picture.live, true)
  assert.throws(() => picture.grade(() => "frames"), /grade refuses a live room/)
})

test("dress leaves the hero outside the cap of two as a sprite", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const warrior = heroGroup("warrior", "z")
  const mage = heroGroup("mage", "m")
  const scout = heroGroup("scout", "s")
  for (const hero of ["warrior", "mage"]) {
    picture.attachStrip(new THREE.DataTexture(new Uint8Array(4), 1, 1), null, hero)
  }
  picture.dress({
    grounds: floors,
    keep,
    stoneMat,
    heroes: [scout.group, warrior.group, mage.group]
  })
  // Sheet heroes take the two lit slots before a voxel-atlas hero.
  assert.equal(warrior.group.userData.card.isMesh, true)
  assert.equal(mage.group.userData.card.isMesh, true)
  assert.equal(scout.group.children.includes(scout.sprite), true)
  assert.equal(scout.group.userData.card.isSprite, true)
})

test("dress leaves a sheet hero as a sprite when only another hero's sheet loaded", () => {
  const picture = createPicture()
  const { stoneMat, keep, floors } = stoneAndGrounds()
  const mage = heroGroup("mage", "m")
  const scout = heroGroup("scout", "s")
  picture.attachStrip(new THREE.DataTexture(new Uint8Array(4), 1, 1), null, "warrior")
  picture.dress({ grounds: floors, keep, stoneMat, heroes: [mage.group, scout.group] })
  assert.equal(mage.group.userData.card, mage.sprite)
  assert.equal(mage.group.userData.hd, undefined)
  assert.equal(scout.group.userData.card.isMesh, true)
  assert.equal(scout.group.userData.hd, "lit")
})

test("dress without a keep throws", () => {
  const picture = createPicture()
  const stoneMat = new THREE.MeshBasicMaterial()
  const grounds = [new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh()]
  const keep = new THREE.Group()
  assert.throws(() => picture.dress({ grounds, stoneMat, heroes: [] }), /dress kit/)
  assert.throws(() => picture.dress({ grounds: grounds.slice(0, 3), keep, stoneMat }), /dress kit/)
  assert.throws(() => picture.dress({ grounds, keep, heroes: [] }), /dress kit/)
  assert.throws(() => picture.dress({ grounds: [grounds[0], null, grounds[2], grounds[3]], keep, stoneMat }), /dress kit/)
})

test("height fog stays off the focal plane and only softens the distance", () => {
  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  assert.equal(fogMix(0, span, span), 0)
  assert.equal(fogMix(36, span, span), 0)
  assert.equal(fogMix(0, span * 0.5, span), 0)
  const far = span * 1.28
  const floor = fogMix(0, far, span)
  const ceiling = fogMix(36, far, span)
  assert.ok(floor > ceiling)
  assert.ok(floor > 0.15)
  assert.ok(floor <= 0.38)
  assert.ok(ceiling < 0.2)
  assert.ok(fogMix(0, span * 4, span) <= 0.38)
  assert.ok(fogMix(36, span * 4, span) < fogMix(0, span * 4, span))
})

test("the circle of confusion is zero at the focus distance", () => {
  const span = 168 / Math.tan((7.5 * Math.PI) / 180)
  assert.equal(circleOfConfusion(span, span), 0)
  const farther = span * (1 + 0.04) + 1
  const nearer = span * (1 - 0.04) - 1
  assert.ok(circleOfConfusion(farther, span) > 0)
  assert.ok(circleOfConfusion(nearer, span) > 0)
  assert.ok(circleOfConfusion(span * 10, span) <= 16)
  assert.ok(circleOfConfusion(span * 1.2, span) > 4)
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
  const picture = createPicture()
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

test("low and phone tiers drop the passes they do not spend", () => {
  function count(picture) {
    let renders = 0
    const renderer = {
      info: { autoReset: true, reset() {} },
      getSize(out) {
        out.x = 320
        out.y = 200
      },
      setRenderTarget() {},
      clear() {},
      render() {
        renders += 1
      }
    }
    picture.present(renderer, new THREE.Scene(), new THREE.PerspectiveCamera())
    return renders
  }
  assert.equal(count(createPicture()), 7)
  const software = createPicture()
  let softwareRenders = 0
  software.present(
    {
      info: { autoReset: true, reset() {} },
      getSize(out) {
        out.x = 320
        out.y = 200
      },
      getContext() {
        return {
          getExtension() {
            return { UNMASKED_RENDERER_WEBGL: 37446 }
          },
          getParameter() {
            return "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"
          }
        }
      },
      setRenderTarget() {},
      clear() {},
      render() {
        softwareRenders += 1
      }
    },
    new THREE.Scene(),
    new THREE.PerspectiveCamera()
  )
  assert.equal(software.tier, "low")
  assert.equal(software.extras.dof, false)
  assert.equal(software.extras.bloom, false)
  assert.equal(softwareRenders, 1)
  const hidden = createPicture()
  let hiddenTargets = 0
  hidden.present(
    {
      info: { autoReset: true, reset() {} },
      getSize(out) {
        out.x = 32
        out.y = 32
      },
      getContext() {
        return { getExtension() { return null } }
      },
      setRenderTarget(target) {
        hiddenTargets += target ? 1 : 0
      },
      clear() {},
      render() {}
    },
    new THREE.Scene(),
    new THREE.PerspectiveCamera()
  )
  assert.equal(hidden.tier, "low")
  assert.equal(hidden.extras.bloom, false)
  assert.equal(hidden.extras.dof, false)
  assert.equal(hiddenTargets, 0)
  assert.equal(
    count(createPicture({ maxTouchPoints: 2, coarse: true, width: 390, height: 844, hardwareConcurrency: 8, deviceMemory: 8 })),
    5
  )
  assert.equal(count(createPicture({ hardwareConcurrency: 2 })), 1)
})

test("two slow paints drop bloom and depth of field", () => {
  const picture = createPicture()
  const renderer = {
    info: { autoReset: true, reset() {} },
    getSize(out) {
      out.x = 64
      out.y = 64
    },
    setRenderTarget() {},
    clear() {},
    render() {
      const start = performance.now()
      while (performance.now() - start < 25) {}
    }
  }
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  picture.present(renderer, scene, camera)
  assert.equal(picture.tier, "high")
  picture.present(renderer, scene, camera)
  assert.equal(picture.tier, "low")
  assert.equal(picture.extras.bloom, false)
  assert.equal(picture.extras.dof, false)
})
