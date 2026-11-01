import * as THREE from "three"
import { present } from "./present"
import { eliteLook } from "./elite"
import { cameraFocus, drawDue, frameFor, paintGap } from "./frame"
import { clockScore } from "./hd2d/score.js"
import { geometryCensus, giveBurst, releaseGeometries, shotSphere, takeBurst, trackGeometry } from "./meshes"
import { pixelStep, snapWorld } from "./art_score.js"
import { nextTrack, poseAt, stepYaw } from "./motion"
import { forestWallSlots, sceneryForest, scenerySlots } from "./scenery"
import { GROUND_SPAN, GROUND_TEX, PLAZA_SPAN, PLAZA_TEX, groundPixels, plazaPixels } from "./ground.js"
import { mountPicture } from "./horizon.js"
import { masonryBytes, propBytes } from "./tiles.js"
import { stoneRepeat, yardCards } from "./yard_cards.js"
import { groundProblems, groundSpread, moodOf, moodProblems } from "./mood.js"
import { zoomFor } from "./town"
import { monsterVisible } from "./cull"
import { heroSignature } from "./heroes"
import { monsterParts } from "./monsters.js"
import { SHEET_HEROES, cellOffset, pictureColumn, sheetRow } from "./pictures.js"
import { sheetHeroSize } from "./hd2d/picture.js"
import { ARRIVE_MS, PORTRAIT_STAND } from "./portrait.js"
import { keepParts, modelParts } from "../models/registry.js"
import { monsterSpread, rimSeat } from "./bodies"
import { rangeRingState } from "./hud"
import { absorbShots, bodyPixel, nextAttackPeak, partyPositions, seatList, swingSeen } from "./paint.js"
import {
  groundColor,
  lightName,
  lumaOf,
  maskedStats,
  ownedNear,
  patchStats,
  plazaColor,
  sampleMinPixels,
  plazaSides,
  ringColor,
  skyColor,
  yardLight
} from "./scene.js"

function projectBoxPixels(box, camera, bufferHeight) {
  const corner = new THREE.Vector3()
  let minY = Infinity
  let maxY = -Infinity
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corner.set(x, y, z).project(camera)
        if (corner.y < minY) minY = corner.y
        if (corner.y > maxY) maxY = corner.y
      }
    }
  }
  return Math.round((maxY - minY) * 0.5 * bufferHeight)
}

function figurePixels(mesh, camera, bufferHeight) {
  return projectBoxPixels(new THREE.Box3().setFromObject(mesh), camera, bufferHeight)
}

// A sprite's center is (0.5, 0), so the feet sit on the group and the card
// faces the camera. Box3 centers that sprite on its position and drops the
// feet by half the height. The drawn quad is the camera-facing card. A lit
// sheet card passes the drawn hero's size, since its cell is wider and taller.
function spriteCardBox(group, camera, size = group.userData.picture) {
  const halfW = size.w / 2
  const yaw = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z)
  const hx = Math.abs(Math.cos(yaw) * halfW)
  const hz = Math.abs(Math.sin(yaw) * halfW)
  const x = group.position.x
  const y = group.position.y
  const z = group.position.z
  return {
    min: { x: x - hx, y, z: z - hz },
    max: { x: x + hx, y: y + size.h, z: z + hz }
  }
}

export function createView(stage, picture) {
  if (["open", "fit", "seat", "light", "dress", "present"].some((name) => typeof picture?.[name] !== "function")) {
    throw new Error("createView needs a picture")
  }

  const opened = picture.open(stage)
  const opening = frameFor(stage.clientWidth || 480, stage.clientHeight || 270)
  const renderer = opened.renderer
  const camera = opened.camera
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.Fog(skyColor, 900, 2400)
  const probe = new THREE.Vector3()
  const rimFrustum = new THREE.Frustum()
  const rimProj = new THREE.Matrix4()
  let viewFrame = opening
  let townRank = 0

  const sky = new THREE.HemisphereLight(yardLight.sky, yardLight.ground, yardLight.hemisphere)
  scene.add(sky)
  const ambient = new THREE.AmbientLight(yardLight.ambient, yardLight.ambientLevel)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(yardLight.sun, yardLight.sunLevel)
  sun.castShadow = true
  sun.shadow.mapSize.set(256, 256)
  sun.shadow.bias = -0.0008
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 900
  sun.shadow.camera.left = -280
  sun.shadow.camera.right = 280
  sun.shadow.camera.top = 280
  sun.shadow.camera.bottom = -280
  scene.add(sun)
  scene.add(sun.target)

  const stoneTile = masonryBytes("day")
  const stoneMap = new THREE.DataTexture(stoneTile.rgba, stoneTile.w, stoneTile.h)
  stoneMap.colorSpace = THREE.SRGBColorSpace
  stoneMap.magFilter = THREE.NearestFilter
  stoneMap.minFilter = THREE.NearestFilter
  stoneMap.wrapS = THREE.RepeatWrapping
  stoneMap.wrapT = THREE.RepeatWrapping
  stoneMap.repeat.set(stoneRepeat.x, stoneRepeat.y)
  stoneMap.needsUpdate = true
  const stoneMat = new THREE.MeshBasicMaterial({ map: stoneMap, color: 0xffffff })
  const stoneColors = new Set([0x4b3c33, 0x654e41, 0x2c2a2a])
  const litTokens = new Set([0xeea821, 0xf5751e])

  const mats = new Map()
  const mat = (color, emissive = 0x000000) => {
    const key = `${color}:${emissive}`
    if (!mats.has(key)) {
      mats.set(
        key,
        new THREE.MeshLambertMaterial({ color, emissive })
      )
    }
    return mats.get(key)
  }

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1900, plazaSides),
    mat(groundColor)
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = false
  ground.visible = false
  scene.add(ground)
  const mapTable = new THREE.Mesh(
    trackGeometry(new THREE.BoxGeometry(36, 8, 22)),
    mat(0x43382e)
  )
  mapTable.position.set(0, 8, 160)
  mapTable.userData.role = "table"
  const mapCloth = new THREE.Group()
  mapCloth.rotation.x = -Math.PI / 2
  mapCloth.position.set(0, 13.2, 160)
  mapCloth.visible = false
  mapCloth.userData.role = "map"
  const clothBoard = new THREE.Mesh(trackGeometry(new THREE.PlaneGeometry(40, 24)), mat(0x6e4b32))
  const clothMarks = new THREE.InstancedMesh(
    trackGeometry(new THREE.PlaneGeometry(40 / 29, 24 / 29)),
    mat(0xe6d3a1),
    29 * 29
  )
  clothMarks.count = 0
  clothMarks.frustumCulled = false
  clothMarks.userData.dummy = new THREE.Object3D()
  mapCloth.add(clothBoard, clothMarks)
  scene.add(mapTable, mapCloth)
  const groundBytes = groundPixels("day")
  const groundMap = new THREE.DataTexture(groundBytes, GROUND_TEX, GROUND_TEX)
  groundMap.colorSpace = THREE.SRGBColorSpace
  groundMap.magFilter = THREE.NearestFilter
  groundMap.minFilter = THREE.NearestFilter
  groundMap.flipY = false
  groundMap.needsUpdate = true
  const yard = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SPAN, GROUND_SPAN),
    new THREE.MeshBasicMaterial({ map: groundMap, color: 0xffffff })
  )
  yard.rotation.x = -Math.PI / 2
  yard.position.y = 0.08
  yard.receiveShadow = false
  scene.add(yard)
  const land = mountPicture(scene)
  const plazaBytes = plazaPixels("day")
  const plazaMap = new THREE.DataTexture(plazaBytes, PLAZA_TEX, PLAZA_TEX)
  plazaMap.colorSpace = THREE.SRGBColorSpace
  plazaMap.magFilter = THREE.NearestFilter
  plazaMap.minFilter = THREE.NearestFilter
  plazaMap.flipY = false
  plazaMap.needsUpdate = true
  const plazaWear = new THREE.Mesh(
    new THREE.CircleGeometry(PLAZA_SPAN / 2, plazaSides),
    new THREE.MeshBasicMaterial({ map: plazaMap, color: 0xffffff })
  )
  plazaWear.rotation.x = -Math.PI / 2
  plazaWear.position.y = 0.24
  scene.add(plazaWear)
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactTexture(),
    transparent: true,
    depthWrite: false
  })

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(150, plazaSides), mat(plazaColor))
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.2
  plaza.receiveShadow = false
  plaza.layers.enable(1)
  const ring = new THREE.Mesh(new THREE.RingGeometry(154, 164, plazaSides), mat(ringColor))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.28
  ring.receiveShadow = false
  scene.add(plaza, ring)
  const sheetKinds = yardCards
  const sheetMaps = {}
  const sheetMats = {}
  for (const [name, spec] of Object.entries(sheetKinds)) {
    const tile = propBytes(name, "day")
    const map = new THREE.DataTexture(tile.rgba, tile.w, tile.h)
    map.colorSpace = THREE.SRGBColorSpace
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.flipY = true
    map.needsUpdate = true
    sheetMaps[name] = map
    sheetMats[name] = spec.stand
      ? new THREE.SpriteMaterial({
          map,
          depthTest: true,
          depthWrite: true,
          transparent: false,
          alphaTest: spec.cut ? 0.5 : 0
        })
      : new THREE.MeshBasicMaterial({ map, color: 0xffffff })
  }
  const windowMat = new THREE.SpriteMaterial({
    color: 0xeea821,
    depthTest: true,
    depthWrite: true,
    transparent: false
  })
  const pathUnit = 18
  const pathTile = propBytes("path", "day")
  const pathNSMap = new THREE.DataTexture(pathTile.rgba, pathTile.w, pathTile.h)
  const pathEWMap = new THREE.DataTexture(pathTile.rgba, pathTile.w, pathTile.h)
  for (const map of [pathNSMap, pathEWMap]) {
    map.colorSpace = THREE.SRGBColorSpace
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.flipY = true
    map.needsUpdate = true
  }
  pathNSMap.repeat.set(1, 280 / pathUnit)
  pathEWMap.repeat.set(280 / pathUnit, 1)
  const pathNS = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 280),
    new THREE.MeshBasicMaterial({ map: pathNSMap, color: 0xffffff })
  )
  pathNS.rotation.x = -Math.PI / 2
  pathNS.position.y = 0.5
  const pathEW = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 18),
    new THREE.MeshBasicMaterial({ map: pathEWMap, color: 0xffffff })
  )
  pathEW.rotation.x = -Math.PI / 2
  pathEW.position.y = 0.48
  scene.add(pathNS, pathEW)

  forest()
  addForestWall()
  let keep = makeKeep(0)
  scene.add(keep)

  const meshes = new Map()
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(30, 22, 12),
    new THREE.MeshBasicMaterial({ color: 0x7ea35a, transparent: true, opacity: 0.55 })
  )
  ghost.position.y = 11
  ghost.visible = false
  scene.add(ghost)
  const rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xf0c14a, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  )
  rangeRing.rotation.x = -Math.PI / 2
  rangeRing.position.y = 0.45
  rangeRing.visible = false
  scene.add(rangeRing)
  const heroRim = new THREE.MeshBasicMaterial({ color: 0x140c0a, side: THREE.BackSide })
  let bearer = { x: 0, z: 0, range: 160 }
  const raycaster = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const focus = new THREE.Vector3()
  let liveMonsters = []
  const tracks = new Map()
  const bursts = []
  let lastTick = -1
  let heroKey = null
  applyFrame()
  window.addEventListener("resize", applyFrame)

  const forestLook = forestState()

  function contactTexture() {
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext("2d")
    const fade = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    fade.addColorStop(0, "rgba(20,16,12,0.78)")
    fade.addColorStop(0.5, "rgba(20,16,12,0.32)")
    fade.addColorStop(1, "rgba(20,16,12,0)")
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  function contactDisc(radius) {
    const mesh = new THREE.Mesh(trackGeometry(new THREE.CircleGeometry(radius, 14)), shadowMat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.46
    mesh.renderOrder = 2
    mesh.userData.contact = true
    return mesh
  }

  function sheetCard(kind, scale = 1, disc = true) {
    const spec = sheetKinds[kind]
    const group = new THREE.Group()
    const card = new THREE.Sprite(sheetMats[kind])
    card.center.set(0.5, 0)
    card.scale.set(spec.w * scale, spec.h * scale, 1)
    card.renderOrder = 1
    group.add(card)
    if (disc) group.add(contactDisc(8 * scale))
    return group
  }

  function addForestWall() {
    for (const slot of forestWallSlots()) {
      const group = sheetCard("tree", slot.scale, false)
      group.position.set(slot.x, 0, slot.z)
      group.traverse((child) => {
        child.castShadow = false
        child.receiveShadow = false
      })
      scene.add(group)
    }
  }

  function forest() {
    const look = sceneryForest()
    const slots = scenerySlots()
    if (!look.parts.includes("stump") || !look.parts.includes("log") || slots.length === 0) return
    for (const slot of slots) {
      const group = sheetCard("scenery", slot.scale, false)
      group.position.set(slot.x, 0, slot.z)
      group.traverse((child) => {
        child.castShadow = false
        child.receiveShadow = false
      })
      scene.add(group)
    }
  }

  function forestState() {
    const look = sceneryForest()
    return {
      trunks: scenerySlots().length,
      wall: forestWallSlots().length,
      wood: look.wood,
      crowns: look.parts.includes("crown") || look.parts.includes("bough"),
      stumps: look.parts.includes("stump") && look.parts.includes("log"),
      treeBoughs: modelParts("tree").filter((part) => part.name === "bough").length
    }
  }

  function makeKeep(rank) {
    const group = new THREE.Group()
    group.userData.rank = rank
    group.userData.role = "keep"
    for (const piece of keepParts(rank)) group.add(pieceMesh(piece))
    const torch = new THREE.PointLight(0xeea821, 8, 220)
    torch.position.set(22, 40, 22)
    torch.layers.set(1)
    group.add(torch)
    group.userData.torch = torch
    return group
  }

  function sync(kind, rows, build) {
    const seen = new Set()
    for (const row of rows) {
      const key = `${kind}:${row.id}`
      seen.add(key)
      let mesh = meshes.get(key)
      if (mesh && kind === "hero" && mesh.userData.hero !== row.hero) {
        scene.remove(mesh)
        releaseGeometries(mesh)
        meshes.delete(key)
        tracks.delete(key)
        mesh = null
      }
      if (!mesh) {
        mesh = build(row)
        if (!mesh.userData.role) mesh.userData.role = kind
        meshes.set(key, mesh)
        scene.add(mesh)
      }
      if (kind === "hero") {
        mesh.userData.preview = !!row.preview
        mesh.userData.fade = Number.isFinite(row.opacity) ? row.opacity : 1
      }
      remember(key, row.x, row.y)
      aimFacing(mesh, row.facing)
      if (kind === "hero") notePose(mesh, row.cds?.attack || 0, row.alive === false)
      if (kind === "monster") notePose(mesh, row.attack_cd || 0, false)
      placeMesh(key, mesh)
      if (mesh.userData.hp) {
        const ratio = row.max ? row.hp / row.max : 1
        mesh.userData.hp.scale.x = Math.max(ratio, 0.05)
      }
    }
    for (const [key, mesh] of meshes) {
      if (key.startsWith(`${kind}:`) && !seen.has(key)) {
        if (kind === "monster" && holdMonsterDeath(key, mesh)) continue
        scene.remove(mesh)
        if (mesh.userData.role !== "shot") releaseGeometries(mesh)
        meshes.delete(key)
        tracks.delete(key)
      }
    }
  }

  let lastRender = 0
  let lastInput = -Infinity
  let renders = 0
  let liveLight = "day"
  let fieldSample = null
  let pending = null
  let drawnTick = -1
  let viewApi = null
  let sampleTarget = null
  const savedClear = new THREE.Color()
  const samplePoint = new THREE.Vector3()
  const sampleBox = new THREE.Box3()
  const sampleSize = new THREE.Vector3()
  const samplePos = new THREE.Vector3()
  const sampleScale = new THREE.Vector3()

  function noteInput() {
    lastInput = performance.now()
  }

  function worldStep() {
    const height = viewFrame.snapHeight || viewFrame.bufferHeight
    return pixelStep(viewFrame.halfH, height)
  }

  let lastSubmit = null
  let driverLabel = null
  let yieldPaintUntil = 0

  function paintFrame() {
    const presented = picture.present(renderer, scene, camera)
    lastSubmit = presented && Number.isFinite(presented.submitMs) ? presented.submitMs : null
    renders += 1
    if (window.__lastKeep) window.__lastKeep.renders = renders
  }

  function sampleYard(gl, canvas) {
    const width = 40
    const height = 20
    if (!gl || canvas.width < width + 32 || canvas.height < height + 32) return null
    const spots = [
      [16, 16],
      [canvas.width - width - 16, 16],
      [16, Math.min(300, canvas.height - height - 16)],
      [canvas.width - width - 16, Math.min(300, canvas.height - height - 16)]
    ]
    const buf = new Uint8Array(width * height * 4)
    let best = null
    let flat = null
    for (const [x, y] of spots) {
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      const stats = patchStats(buf)
      // The circle past the tile is one lit color. Variance 0 was beating the
      // clearing, and the house was then scored against that disc.
      if (stats.variance === 0) {
        if (!flat) flat = stats
        continue
      }
      // The horizon quilt is smoother than the clearing and brighter, so the
      // lowest variance now lands on that skirt. The clearing is the dark patch.
      if (!best || stats.luma < best.luma) best = stats
    }
    const picked = best || flat
    return picked ? { ...picked, light: liveLight } : null
  }

  window.addEventListener("pointerdown", noteInput)
  window.addEventListener("keydown", noteInput)

  let closed = false

  function frame() {
    if (closed) return
    // A quiet guest stays in the room through the socket and the input
    // interval. Presenting that page is the paint that fills the runner.
    // The callback stays so wake() can present again without a new loop.
    if (window.__lastKeepQuiet) {
      requestAnimationFrame(frame)
      return
    }
    const now = performance.now()
    // A slow paint used to chain straight into the next one. The 20ms blend
    // poll then never landed inside the 45ms window. The gap is the idle
    // stretch after that paint, and it is longer than the window.
    if (now < yieldPaintUntil) {
      requestAnimationFrame(frame)
      return
    }
    // The socket handler only queues. Drawing here lets the test's wait run
    // between snapshots. A draw inside the handler piles up and the page
    // never returns, so the fireball wait dies when the browser closes.
    if (pending && viewApi && pending.snap.tick !== drawnTick && drawDue(now, lastRender, lastInput)) {
      viewApi.draw(pending.snap, pending.selfId)
      drawnTick = pending.snap.tick
    }
    if (pending && (window.__lastKeepArrive || boundLook())) placeCamera(pending.snap, pending.selfId)
    for (const [, mesh] of meshes) stepFacing(mesh)
    for (const [key, mesh] of meshes) placeMesh(key, mesh)
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i]
      const age = (now - burst.at) / 520
      if (age >= 1) {
        scene.remove(burst.mesh)
        giveBurst(burst.mesh)
        bursts.splice(i, 1)
      } else {
        burst.mesh.scale.setScalar(1 + age * 3.2)
        burst.mesh.material.opacity = 1 - age
      }
    }
    const heroMesh = heroKey ? meshes.get(heroKey) : null
    if (heroMesh && window.__lastKeep) {
      window.__lastKeep.rendered = { x: heroMesh.position.x, z: heroMesh.position.z }
    }
    cullActors()
    if (drawDue(now, lastRender, lastInput)) {
      const started = performance.now()
      paintFrame()
      publishPerf(performance.now() - started)
      lastRender = now
    } else {
      publishPerf(null)
    }
    const gap = paintGap(performance.now() - now)
    if (gap) yieldPaintUntil = performance.now() + gap
    requestAnimationFrame(frame)
  }

  // The first paint can sit inside shader compile. Waiting for load lets the
  // document finish so a navigation is not stuck behind that compile.
  if (typeof document !== "undefined" && document.readyState !== "complete") {
    window.addEventListener("load", () => requestAnimationFrame(frame), { once: true })
  } else {
    requestAnimationFrame(frame)
  }

  viewApi = {
    canvas: renderer.domElement,
    rims(show) {
      showRims(show)
    },
    repaint() {
      const frame = renderer.info.render.frame
      cullActors()
      paintFrame()
      publishPerf(null)
      const perf = window.__lastKeepPerf
      return {
        calls: perf.calls,
        triangles: perf.triangles,
        rims: perf.rims,
        painted: renderer.info.render.frame !== frame
      }
    },
    queue(snap, selfId) {
      pending = { snap, selfId }
      placeCamera(snap, selfId)
      nudge(snap, selfId)
    },
    stop() {
      closed = true
      window.removeEventListener("resize", applyFrame)
      window.removeEventListener("pointerdown", noteInput)
      window.removeEventListener("keydown", noteInput)
    },
    aim(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect()
      let nearest = null
      let nearestPx = 64
      for (const monster of liveMonsters) {
        const point = new THREE.Vector3(monster.x, 16, monster.y).project(camera)
        const sx = rect.left + (point.x * 0.5 + 0.5) * rect.width
        const sy = rect.top + (-point.y * 0.5 + 0.5) * rect.height
        const dist = Math.hypot(sx - clientX, sy - clientY)
        if (dist < nearestPx) {
          nearestPx = dist
          nearest = monster
        }
      }
      if (nearest) return { x: nearest.x, y: nearest.y, monster: true }
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      return { x: hit.x, y: hit.z, monster: false }
    },
    project(x, z) {
      const point = new THREE.Vector3(x, 8, z).project(camera)
      return { x: point.x, y: point.y, behind: point.z > 1 }
    },
    draw(snap, selfId) {
      drawnTick = snap.tick
      const name = lightName(snap)
      liveLight = name
      townRank = snap.town || 0
      applyFrame()
      const zoom = zoomFor(snap)
      const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
      seatCamera(snap, me)
      const yardScale = zoom.dirt / 150
      plaza.scale.setScalar(yardScale)
      ring.scale.setScalar(yardScale)
      const pathSpan = yardScale
      pathNS.scale.set(1, pathSpan, 1)
      pathEW.scale.set(pathSpan, 1, 1)
      pathNSMap.repeat.set(1, (280 * pathSpan) / pathUnit)
      pathEWMap.repeat.set((280 * pathSpan) / pathUnit, 1)
      if (keep.userData.rank !== townRank) {
        releaseGeometries(keep)
        scene.remove(keep)
        keep = makeKeep(townRank)
        scene.add(keep)
      }
      const keepRatio = snap.keep.max ? snap.keep.hp / snap.keep.max : 1
      keep.scale.y = 0.65 + keepRatio * 0.35

      const drawn = present(snap)

      if (me) bearer = { x: me.x, z: me.y, range: me.range || bearer.range }

      sync("hero", drawn.heroes, (row) => buildHero(row, selfId))

      const heroes = [...meshes.values()].filter((mesh) => mesh.userData.role === "hero")
      picture.dress({ grounds: [yard, plazaWear, pathNS, pathEW], keep, stoneMat, heroes })
      dissolveYardEdge(yard)
      picture.light(name, { scene, sun, ambient, hemi: sky, torch: keep.userData.torch })

      liveMonsters = snap.monsters || []

      sync("monster", drawn.monsters, (row) => monsterMesh(row))

      sync("building", drawn.buildings, (row) => buildingMesh(row))

      sync("tree", snap.trees || [], () => sheetCard("tree", 1, false))

      paintMapCloth(mapCloth, clothMarks, snap.map)
      sync("chest", snap.chests || [], () => {
        const mesh = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(16, 12, 16)), mat(0xf0c14a, 0xc9a227))
        mesh.userData.lift = 8
        mesh.userData.role = "chest"
        return mesh
      })

      sync("shot", snap.projectiles || [], (row) => {
        const fire = row.kind === "fireball" || row.kind === "meteor"
        const color = fire ? 0xff7a2a : 0xf2e2b0
        const size = row.kind === "fireball" ? 11 : row.kind === "meteor" ? 14 : 6
        const mesh = new THREE.Mesh(shotSphere(size), mat(color, color))
        mesh.userData.lift = row.kind === "meteor" ? 28 : row.kind === "fireball" ? 18 : 12
        mesh.userData.role = "shot"
        return mesh
      })

      if (snap.tick !== lastTick) {
        lastTick = snap.tick
        for (const ev of snap.events || []) {
          if (ev.type === "boom") addBurst(ev.x, ev.y, 0xff7a2a)
          if (ev.type === "death") addBurst(ev.x, ev.y, 0xffe08a)
          if (ev.type === "slam") addBurst(ev.x, ev.y, 0xc45cff)
        }
      }

      const kept = window.__lastKeep || {}
      const counts = { heroes: 0, monsters: 0, shots: 0 }
      scene.traverse((object) => {
        if (object.userData?.role === "hero") counts.heroes += 1
        if (object.userData?.role === "monster") counts.monsters += 1
        if (object.userData?.role === "shot") counts.shots += 1
      })
      const monsters = (snap.monsters || []).map((monster) => {
        const point = new THREE.Vector3(monster.x, 16, monster.y).project(camera)
        const body = meshes.get(`monster:${monster.id}`)
        const spread = body?.userData.spread || { x: 0, z: 0 }
        return {
          id: monster.id,
          kind: monster.kind,
          x: monster.x,
          y: monster.y,
          spreadX: spread.x,
          spreadZ: spread.z,
          drawX: body ? body.position.x : null,
          drawZ: body ? body.position.z : null,
          onScreen: Math.abs(point.x) < 0.72 && Math.abs(point.y) < 0.62 && point.z < 1
        }
      })
      const figures = []
      for (const [key, mesh] of meshes) {
        if (!key.startsWith("hero:") || !mesh.userData.hero) continue
        const card = mesh.userData.card
        const picture = mesh.userData.picture
        const sheet = card && card.isMesh && picture && SHEET_HEROES.includes(mesh.userData.hd)
        const px =
          card && picture && (card.isSprite || sheet)
            ? projectBoxPixels(
                spriteCardBox(mesh, camera, sheet ? sheetHeroSize(card, picture) : picture),
                camera,
                viewFrame.bufferHeight
              )
            : figurePixels(card || mesh, camera, viewFrame.bufferHeight)
        figures.push({
          id: key.slice(5),
          hero: mesh.userData.hero,
          box: heroScreenBox(mesh),
          parts: mesh.userData.parts,
          marks: mesh.userData.marks,
          bounds: mesh.userData.bounds,
          x: mesh.position.x,
          z: mesh.position.z,
          px
        })
      }
      const keepBounds = new THREE.Box3().setFromObject(keep)
      const keepFigure = {
        px: figurePixels(keep, camera, viewFrame.bufferHeight),
        worldH: keepBounds.max.y - keepBounds.min.y,
        min: { x: keepBounds.min.x, y: keepBounds.min.y, z: keepBounds.min.z },
        max: { x: keepBounds.max.x, y: keepBounds.max.y, z: keepBounds.max.z }
      }
      heroKey = me ? `hero:${me.id}` : null
      const heroMesh = heroKey ? meshes.get(heroKey) : null
      const heroTrack = heroKey ? tracks.get(heroKey) : null
      window.__lastKeep = {
        counts,
        phase: snap.phase,
        light: lightName(snap),
        field: fieldSample,
        hold: !!snap.hold,
        wave: snap.wave,
        keep: snap.keep,
        wood: snap.resources?.wood,
        gold: snap.resources?.gold,
        kills: snap.kills,
        score: snap.score ?? 0,
        self: me
          ? {
              x: me.x,
              y: me.y,
              name: me.name,
              hero: me.hero,
              host: me.host,
              range: me.range,
              attackCd: me.cds?.attack || 0,
              alive: me.alive,
              hp: me.hp
            }
          : null,
        attackCd: me?.cds?.attack || 0,
        attackPeak: nextAttackPeak(kept.attackPeak, me?.cds?.attack || 0, swingSeen(snap)),
        cds: me?.cds || null,
        monsters,
        vagrants: snap.vagrants || [],
        figures,
        keepFigure,
        rangeRing: rangeRingState(rangeRing.visible, bearer.range),
        buildings: (snap.buildings || []).length,
        town: snap.town,
        dirt: snap.dirt,
        ring: ring.scale.x,
        structures: (snap.buildings || []).map((row) => ({
          kind: row.kind,
          x: row.x,
          y: row.y
        })),
        projectiles: snap.projectiles || [],
        chests: snap.chests || [],
        portals: snap.portals || [],
        chunks: snap.chunks || [],
        map: snap.map || null,
        land: snap.land || [],
        table: { x: 0, y: 160, cloth: mapCloth.visible },
        relics: snap.relics || [],
        forge: !!snap.forge,
        mageTower: !!snap.mage_tower,
        shownWave: snap.shown_wave,
        smoothing: true,
        townLook: {
          rank: townRank,
          keep: keepParts(townRank).map((part) => part.name),
          keepColors: [...new Set(keepParts(townRank).map((part) => part.color))],
          plaza: plazaColor,
          plazaSides,
          path: true,
          bestiary: ["goblin", "skeleton", "wolf", "troll", "bat", "boss"]
        },
        forestLook,
        rendered: heroMesh ? { x: heroMesh.position.x, z: heroMesh.position.z } : null,
        motion: heroTrack
          ? { fromX: heroTrack.fromX, fromZ: heroTrack.fromZ, toX: heroTrack.toX, toZ: heroTrack.toZ, at: heroTrack.at }
          : null,
        frame: {
          mode: "hd2d",
          aspect: viewFrame.aspect,
          bufferWidth: renderer.domElement.width,
          bufferHeight: renderer.domElement.height,
          halfW: viewFrame.halfW,
          halfH: viewFrame.halfH,
          fov: picture.fov
        },
        contact: selfContact(heroMesh),
        driver: driverName(),
        renders,
        toClient,
        redNear,
        brightNear,
        patchAt,
        sampleWorld,
        sampleObject,
        frameMood,
        frameGround,
        frameGrade,
        yardGrade,
        duskGrade,
        nightGrade,
        blend,
        pictureGrade,
        tick: snap.tick,
        alive: me ? !!me.alive : !!kept.alive,
        hp: me ? me.hp : kept.hp,
        party: partyPositions(snap.players),
        seats: seatList(snap.players),
        kinds: absorbShots(kept.kinds, snap.projectiles),
        log: kept.log || [],
        labels: kept.labels || [],
        audio: kept.audio
      }
    },
    grade() {
      return picture.grade(() => {
        const buffers = []
        for (const clock of ["day", "dusk", "night"]) {
          viewApi.draw(stillSnap(clock), "still-warrior")
          const shot = readFrame()
          buffers.push({ rgba: shot.buf, width: shot.width, height: shot.height, frameMs: shot.frameMs })
        }
        return buffers
      })
    },
    ghost(kind, x, z, ok) {
      ghost.visible = !!kind
      const ring = rangeRingState(!!kind, bearer.range)
      rangeRing.visible = ring.on
      if (ring.on) {
        rangeRing.position.set(bearer.x, 0.45, bearer.z)
        rangeRing.scale.setScalar(ring.radius)
      }
      if (window.__lastKeep) window.__lastKeep.rangeRing = ring
      if (!kind) return
      ghost.position.set(x, 11, z)
      ghost.material.color.set(ok ? 0x7ea35a : 0xc84b3a)
    }
  }
  return viewApi

  // The heavy scene sync can skip ticks. The hero still has to take each
  // step, or the rendered body lands more than one tick behind the server.
  function nudge(snap, selfId) {
    const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
    if (window.__lastKeep && me && window.__lastKeep.self) {
      window.__lastKeep.self = { ...window.__lastKeep.self, x: me.x, y: me.y }
    }
    for (const row of snap.players || []) {
      const mesh = meshes.get(`hero:${row.id}`)
      if (!mesh) continue
      remember(`hero:${row.id}`, row.x, row.y)
      aimFacing(mesh, row.facing)
    }
    const heroTrack = heroKey ? tracks.get(heroKey) : null
    if (window.__lastKeep && heroTrack) {
      window.__lastKeep.motion = {
        fromX: heroTrack.fromX,
        fromZ: heroTrack.fromZ,
        toX: heroTrack.toX,
        toZ: heroTrack.toZ,
        at: heroTrack.at
      }
    }
    for (const row of snap.monsters || []) {
      if (!meshes.has(`monster:${row.id}`)) continue
      remember(`monster:${row.id}`, row.x, row.y)
    }
  }

  function arriveBlend() {
    const mark = window.__lastKeepArrive
    if (!mark) return 1
    if (mark === "wait") {
      window.__lastKeepArrive = performance.now()
      return 0
    }
    const t = (performance.now() - mark) / ARRIVE_MS
    if (t >= 1) {
      window.__lastKeepArrive = 0
      return 1
    }
    return t
  }

  function dissolveYardEdge(mesh) {
    const material = mesh.material
    if (!material || material.userData.yardEdge) return
    material.userData.yardEdge = true
    material.customProgramCacheKey = () => "yard-edge"
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        "float yardMargin = 0.5 - max(abs(vMapUv.x - 0.5), abs(vMapUv.y - 0.5));\n\tfloat yardBand = 1.0 - smoothstep(0.0, 0.1, yardMargin);\n\tfloat yardDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n\tif (yardDither < yardBand) discard;\n\t#include <dithering_fragment>"
      )
    }
    material.needsUpdate = true
  }

  function boundLook() {
    const look = window.__lastKeepLook
    if (!look || !Number.isFinite(look.x) || !Number.isFinite(look.z)) return null
    return { x: look.x, z: look.z }
  }

  function seatCamera(snap, me) {
    const portrait = !!snap.portrait
    const hero = portrait
      ? { x: PORTRAIT_STAND.x, z: PORTRAIT_STAND.z }
      : { x: me?.x || 0, z: me?.y || 0 }
    const bound = portrait ? null : boundLook()
    const anchor = portrait ? hero : bound || cameraFocus(me?.x, me?.y)
    const step = worldStep()
    focus.set(snapWorld(anchor.x, step), 0, snapWorld(anchor.z, step))
    const dist = zoomFor(snap).camera
    picture.seat(camera, focus, dist, snap, {
      blend: portrait ? 0 : arriveBlend(),
      hero,
      cssW: viewFrame.bufferWidth,
      cssH: viewFrame.bufferHeight
    })
    land.sync(snap, camera, viewFrame.halfH)
  }

  function placeCamera(snap, selfId) {
    const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
    seatCamera(snap, me)
  }

  function heroScreenBox(mesh) {
    const picture = mesh.userData.picture
    const rect = renderer.domElement.getBoundingClientRect()
    if (!picture || rect.width < 1 || rect.height < 1) return null
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    const center = mesh.position.clone().addScaledVector(up, picture.h / 2)
    const corners = [
      [1, -1],
      [1, 1],
      [-1, -1],
      [-1, 1]
    ]
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [uy, rx] of corners) {
      const point = center
        .clone()
        .addScaledVector(up, (uy * picture.h) / 2)
        .addScaledVector(right, (rx * picture.w) / 2)
        .project(camera)
      const x = rect.left + (point.x * 0.5 + 0.5) * rect.width
      const y = rect.top + (-point.y * 0.5 + 0.5) * rect.height
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }

  function toClient(x, z) {
    const point = new THREE.Vector3(x, 16, z).project(camera)
    const rect = renderer.domElement.getBoundingClientRect()
    return {
      x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-point.y * 0.5 + 0.5) * rect.height
    }
  }

  function redNear(x, z, y = 16) {
    paintFrame()
    const gl = renderer.getContext()
    const point = new THREE.Vector3(x, y, z).project(camera)
    const canvas = renderer.domElement
    const px = Math.round((point.x * 0.5 + 0.5) * canvas.width)
    const py = Math.round((-point.y * 0.5 + 0.5) * canvas.height)
    const size = 17
    const sx0 = Math.max(0, px - 8)
    const sy0 = Math.max(0, py - 8)
    const width = Math.min(size, canvas.width - sx0)
    const height = Math.min(size, canvas.height - sy0)
    const buf = new Uint8Array(width * height * 4)
    gl.readPixels(sx0, Math.max(0, canvas.height - (sy0 + height)), width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    let count = 0
    for (let i = 0; i < buf.length; i += 4) {
      if (bodyPixel(buf[i], buf[i + 1], buf[i + 2])) count += 1
    }
    return count
  }

  function sampleWorld(x, y, z) {
    return sampleObject(x, y, z)
  }

  // The object's own fragments, not an 8×8 patch that can land on the ground
  // behind a crown, between the boots, or on a sunset fleck. The match loop
  // does not call this.
  function sampleObject(x, y, z) {
    const label = `${x}, ${y}, ${z}`
    const object = objectAt(x, y, z)
    if (!object) throw new Error(`sample missed: no mesh owns (${label})`)
    const canvas = renderer.domElement
    const rect = boundsRect(object, canvas.width, canvas.height)
    if (!rect) throw new Error(`sample missed: (${label}) has no screen bounds`)
    const w = rect.x1 - rect.x0
    const h = rect.y1 - rect.y0
    const shot = renderIsolated(object, rect)
    samplePoint.set(x, y, z).project(camera)
    const px = (samplePoint.x * 0.5 + 0.5) * canvas.width
    const py = (-samplePoint.y * 0.5 + 0.5) * canvas.height
    const qx = Math.min(w - 1, Math.max(0, px - rect.x0))
    const qy = Math.min(h - 1, Math.max(0, rect.y1 - 1 - py))
    if (shot.clear[0] === 0 && shot.clear[1] === 0 && shot.clear[2] === 0) {
      throw new Error(`sample unread: (${label})`)
    }
    const picked = ownedNear(shot.beauty, w, h, qx, qy, shot.clear, sampleMinPixels)
    const role = objectRole(object)
    return maskedStats(shot.beauty, picked.mask, {
      min: sampleMinPixels,
      label: `${role} at (${label})`
    })
  }

  function objectRole(object) {
    let node = object
    while (node) {
      if (node.userData && node.userData.role) return node.userData.role
      node = node.parent
    }
    return object.isSprite ? "sprite" : "mesh"
  }

  function drawnObject(object) {
    let node = object
    while (node) {
      if (node.visible === false) return false
      node = node.parent
    }
    return true
  }

  function shadowOnly(object) {
    const material = object.material
    return !!(material && material.transparent && material.depthWrite === false)
  }

  function objectBounds(object, target) {
    if (object.isSprite) {
      object.getWorldPosition(samplePos)
      object.getWorldScale(sampleScale)
      const cx = object.center.x
      const cy = object.center.y
      const sw = Math.abs(sampleScale.x) || 1
      const sh = Math.abs(sampleScale.y) || 1
      const sd = Math.max(sw, 4)
      const minX = (-0.5 - (cx - 0.5)) * sw
      const maxX = (0.5 - (cx - 0.5)) * sw
      const minY = (-0.5 - (cy - 0.5)) * sh
      const maxY = (0.5 - (cy - 0.5)) * sh
      target.min.set(samplePos.x + minX, samplePos.y + minY, samplePos.z - sd / 2)
      target.max.set(samplePos.x + maxX, samplePos.y + maxY, samplePos.z + sd / 2)
      return target
    }
    return target.setFromObject(object)
  }

  function objectAt(x, y, z) {
    scene.updateMatrixWorld(true)
    samplePoint.set(x, y, z)
    let best = null
    let bestVol = Infinity
    scene.traverse((object) => {
      if (!object.isMesh && !object.isSprite) return
      if (!drawnObject(object) || shadowOnly(object)) return
      const role = object.userData && object.userData.role
      if (role === "horizon" || role === "far-pine" || role === "portal") return
      objectBounds(object, sampleBox)
      if (sampleBox.isEmpty()) return
      sampleBox.expandByScalar(1.5)
      if (!sampleBox.containsPoint(samplePoint)) return
      sampleBox.getSize(sampleSize)
      const volume = Math.max(sampleSize.x, 0.5) * Math.max(sampleSize.y, 0.5) * Math.max(sampleSize.z, 0.5)
      if (volume < bestVol) {
        best = object
        bestVol = volume
      }
    })
    return best
  }

  function boundsRect(object, width, height) {
    objectBounds(object, sampleBox)
    if (sampleBox.isEmpty()) return null
    const corner = samplePoint
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let seen = 0
    for (const cx of [sampleBox.min.x, sampleBox.max.x]) {
      for (const cy of [sampleBox.min.y, sampleBox.max.y]) {
        for (const cz of [sampleBox.min.z, sampleBox.max.z]) {
          corner.set(cx, cy, cz).project(camera)
          if (corner.z > 1) continue
          const px = (corner.x * 0.5 + 0.5) * width
          const py = (-corner.y * 0.5 + 0.5) * height
          if (px < minX) minX = px
          if (px > maxX) maxX = px
          if (py < minY) minY = py
          if (py > maxY) maxY = py
          seen += 1
        }
      }
    }
    if (!seen) return null
    const x0 = Math.max(0, Math.floor(minX))
    const y0 = Math.max(0, Math.floor(minY))
    const x1 = Math.min(width, Math.ceil(maxX))
    const y1 = Math.min(height, Math.ceil(maxY))
    if (x1 - x0 < 1 || y1 - y0 < 1) return null
    return { x0, y0, x1, y1 }
  }

  function targetFor(width, height) {
    if (!sampleTarget || sampleTarget.width !== width || sampleTarget.height !== height) {
      if (sampleTarget) sampleTarget.dispose()
      sampleTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true
      })
      sampleTarget.texture.colorSpace = THREE.SRGBColorSpace
    }
    return sampleTarget
  }

  function isolate(object) {
    const saved = []
    scene.traverse((node) => {
      saved.push(node, node.visible)
      if (node.isLight) return
      node.visible = false
    })
    let node = object
    while (node) {
      node.visible = true
      node = node.parent
    }
    object.traverse((child) => {
      child.visible = true
    })
    return () => {
      for (let i = 0; i < saved.length; i += 2) saved[i].visible = saved[i + 1]
    }
  }

  function outsideCorner(rect, width, height) {
    const spots = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1]
    ]
    for (const [x, y] of spots) {
      const top = height - 1 - y
      if (x < rect.x0 || x >= rect.x1 || top < rect.y0 || top >= rect.y1) return [x, y]
    }
    return [0, 0]
  }

  function renderIsolated(object, rect) {
    const canvas = renderer.domElement
    const target = targetFor(canvas.width, canvas.height)
    const previousBackground = scene.background
    const previousFog = scene.fog
    const previousOverride = scene.overrideMaterial
    const previousAlpha = renderer.getClearAlpha()
    renderer.getClearColor(savedClear)
    const restore = isolate(object)
    const beauty = new Uint8Array((rect.x1 - rect.x0) * (rect.y1 - rect.y0) * 4)
    const clearBuf = new Uint8Array(4)
    try {
      scene.background = new THREE.Color(0xff00ff)
      scene.fog = null
      scene.overrideMaterial = null
      renderer.setClearColor(0xff00ff, 1)
      renderer.setRenderTarget(target)
      renderer.clear(true, true, true)
      renderer.render(scene, camera)
      const glY = canvas.height - rect.y1
      renderer.readRenderTargetPixels(target, rect.x0, glY, rect.x1 - rect.x0, rect.y1 - rect.y0, beauty)
      const corner = outsideCorner(rect, canvas.width, canvas.height)
      renderer.readRenderTargetPixels(target, corner[0], corner[1], 1, 1, clearBuf)
    } finally {
      renderer.setRenderTarget(null)
      scene.background = previousBackground
      scene.fog = previousFog
      scene.overrideMaterial = previousOverride
      renderer.setClearColor(savedClear, previousAlpha)
      restore()
    }
    return { beauty, clear: [clearBuf[0], clearBuf[1], clearBuf[2]] }
  }

  function stillSnap(clock) {
    const night = clock === "night"
    const dusk = clock === "dusk"
    const player = (id, hero, name, x, y, facing, hp) => ({
      id,
      hero,
      name,
      x,
      y,
      facing,
      hp,
      max: hp,
      alive: true,
      cds: { attack: 0 }
    })
    return {
      hd2dStill: true,
      tick: night ? 3 : dusk ? 2 : 1,
      phase: night ? "wave" : "build",
      phase_ms: dusk ? 4000 : 60000,
      hold: false,
      town: 0,
      wave: night ? 1 : 0,
      shown_wave: night ? 1 : 0,
      keep: { hp: 900, max: 900 },
      resources: { wood: 40, gold: 0, food: 0 },
      players: [
        player("still-warrior", "warrior", "Ada", 88, 36, 0, 100),
        player("still-mage", "mage", "Lux", 112, 78, 0.4, 80)
      ],
      monsters: [],
      buildings: [],
      trees: [],
      chests: [],
      portals: [],
      projectiles: [],
      events: [],
      relics: [],
      vagrants: [],
      chunks: [],
      land: [],
      kills: 0,
      score: 0
    }
  }

  function selfContact(mesh) {
    if (mesh) {
      for (const child of mesh.children) {
        if (!child.visible || !child.isMesh || !child.material || !child.material.color) continue
        if (child.material.color.getHex() === 0xf0c14a && child.position.y > 0 && child.position.y < 2) return "plate"
      }
    }
    return "shadow"
  }

  function driverName() {
    if (driverLabel != null) return driverLabel
    driverLabel = ""
    try {
      const gl = renderer.getContext()
      const info = gl.getExtension("WEBGL_debug_renderer_info")
      if (info) driverLabel = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "")
    } catch (_err) {
      driverLabel = ""
    }
    return driverLabel
  }

  function readFrame() {
    const started = performance.now()
    paintFrame()
    const canvas = renderer.domElement
    const gl = renderer.getContext()
    const width = canvas.width
    const height = canvas.height
    const raw = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw)
    // readPixels is bottom-up. The ground band counts from the top of the picture,
    // the same way the jpeg check does, so the near yard is the rows under the sky.
    const buf = new Uint8Array(width * height * 4)
    const stride = width * 4
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * stride
      buf.set(raw.subarray(src, src + stride), y * stride)
    }
    return { buf, width, height, frameMs: performance.now() - started }
  }

  function frameMood() {
    const shot = readFrame()
    const mood = moodOf(shot.buf, shot.width, shot.height)
    return { ...mood, light: liveLight, problems: moodProblems(mood, liveLight) }
  }

  function frameGround() {
    const shot = readFrame()
    const read = groundSpread(shot.buf, shot.width, shot.height)
    return { ...read, light: liveLight, problems: groundProblems(read) }
  }

  function frameGrade() {
    const shot = readFrame()
    const mood = moodOf(shot.buf, shot.width, shot.height)
    const ground = groundSpread(shot.buf, shot.width, shot.height)
    return {
      mood: { ...mood, light: liveLight, problems: moodProblems(mood, liveLight) },
      ground: { ...ground, light: liveLight, problems: groundProblems(ground) }
    }
  }

  // One framebuffer read. The numbers are the HD-2D clock score for this light.
  function clockGrade(clock) {
    if (liveLight !== clock) return null
    const shot = readFrame()
    const score = clockScore(clock, { rgba: shot.buf, width: shot.width, height: shot.height })
    const ok = Object.values(score).every((value) => Number.isFinite(value))
    return {
      ok,
      ...score,
      light: clock,
      mode: "hd2d",
      fov: picture.fov,
      width: shot.width,
      height: shot.height
    }
  }

  function yardGrade() {
    return clockGrade("day")
  }

  function duskGrade() {
    return clockGrade("dusk")
  }

  function nightGrade() {
    const grade = clockGrade("night")
    return grade && grade.ok ? grade : null
  }

  // The blend window is 45ms. An open step is past a twitch and short of a teleport.
  function blend(origin) {
    const game = window.__lastKeep
    const track = game && game.motion
    const self = game && game.self
    if (!track || !self) return null
    const step = Math.hypot(track.toX - track.fromX, track.toZ - track.fromZ)
    const age = performance.now() - track.at
    const sx = self.x
    const sz = self.y
    const open = step > 0.4 && step < 14 && age >= 0 && age < 45
    const travel = origin ? Math.hypot(sx - origin.x, sz - origin.y) : 0
    return { step, age, sx, sz, open, travel }
  }

  function pictureGrade() {
    return clockGrade(liveLight)
  }

  function patchAt(x, z) {
    return sampleObject(x, 2, z)
  }

  function brightNear(x, z, height = 16) {
    paintFrame()
    fieldSample = sampleYard(renderer.getContext(), renderer.domElement)
    if (window.__lastKeep) window.__lastKeep.field = fieldSample
    const gl = renderer.getContext()
    const point = new THREE.Vector3(x, height, z).project(camera)
    const canvas = renderer.domElement
    const px = Math.round((point.x * 0.5 + 0.5) * canvas.width)
    const py = Math.round((-point.y * 0.5 + 0.5) * canvas.height)
    const size = 160
    const sx0 = Math.max(0, px - 80)
    const sy0 = Math.max(0, py - 80)
    const width = Math.min(size, canvas.width - sx0)
    const heightPx = Math.min(size, canvas.height - sy0)
    const buf = new Uint8Array(width * heightPx * 4)
    gl.readPixels(sx0, Math.max(0, canvas.height - (sy0 + heightPx)), width, heightPx, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    const field = fieldSample ? fieldSample.luma : 0
    let max = 0
    let above = 0
    for (let i = 0; i < buf.length; i += 4) {
      const luma = lumaOf(buf[i], buf[i + 1], buf[i + 2])
      if (luma > max) max = luma
      if (luma >= field + 18) above += 1
    }
    return { max, above, field }
  }

  function remember(key, x, z) {
    const prev = tracks.get(key)
    tracks.set(key, nextTrack(prev, x, z, performance.now()))
  }

  function aimFacing(mesh, facing) {
    if (!mesh.userData.face || !Number.isFinite(facing)) return
    const target = -facing
    if (mesh.userData.preview) {
      mesh.rotation.y = target
      mesh.userData.yawTarget = target
      return
    }
    if (!Number.isFinite(mesh.userData.yawTarget)) mesh.rotation.y = target
    mesh.userData.yawTarget = target
  }

  function stepFacing(mesh) {
    if (!mesh.userData.face || !Number.isFinite(mesh.userData.yawTarget)) return
    const next = stepYaw(mesh.rotation.y, mesh.userData.yawTarget)
    mesh.rotation.y = next.yaw
    const step = Math.abs(next.step)
    if (step === 0) return
    const perf = window.__lastKeepPerf || (window.__lastKeepPerf = { paints: [] })
    if (step > (perf.maxStep || 0)) perf.maxStep = step
  }

  function smoothed(key) {
    return poseAt(tracks.get(key), performance.now())
  }

  function notePose(mesh, cd, dead) {
    const pose = mesh.userData.pose || {}
    const now = performance.now()
    if (Number.isFinite(pose.lastCd) && cd > pose.lastCd + 40) pose.attackAt = now
    pose.lastCd = cd
    if (dead) {
      if (!pose.dead) pose.deadAt = now
      pose.dead = true
    } else {
      pose.dead = false
      pose.deadAt = 0
    }
    mesh.userData.pose = pose
  }

  function holdMonsterDeath(key, mesh) {
    const pose = mesh.userData.pose || {}
    const now = performance.now()
    if (!pose.dead) {
      pose.dead = true
      pose.deadAt = now
      mesh.userData.pose = pose
    }
    const picture = mesh.userData.picture
    const span = Math.max(picture?.death || 4, 1) * 160
    if (now - pose.deadAt >= span) return false
    placeMesh(key, mesh)
    return true
  }

  function paintMapCloth(group, marks, map) {
    const chunks = map && map.chunks
    if (!chunks) {
      group.visible = false
      return
    }
    const sig = chunks.map((chunk) => `${chunk.cx},${chunk.cy}`).join("|")
    if (sig !== marks.userData.sig) {
      const dummy = marks.userData.dummy
      let n = 0
      for (const chunk of chunks) {
        const px = chunk.cx + 14
        const py = 14 - chunk.cy
        if (px < 0 || py < 0 || px > 28 || py > 28) continue
        dummy.position.set(((px + 0.5) / 29 - 0.5) * 40, (0.5 - (py + 0.5) / 29) * 24, 0.05)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        marks.setMatrixAt(n, dummy.matrix)
        n += 1
      }
      marks.count = n
      marks.instanceMatrix.needsUpdate = true
      marks.userData.sig = sig
    }
    group.visible = true
  }

  function placeMesh(key, mesh) {
    const pose = smoothed(key)
    const spread = mesh.userData.spread || { x: 0, z: 0 }
    const step = worldStep()
    mesh.position.set(snapWorld(pose.x + spread.x, step), mesh.userData.lift || 0, snapWorld(pose.z + spread.z, step))
    const card = mesh.userData.card
    if (!card) return
    const picture = mesh.userData.picture
    const viewYaw = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z)
    const facing = Number.isFinite(mesh.rotation.y) ? -mesh.rotation.y : 0
    const column = pictureColumn(viewYaw, facing)
    const track = tracks.get(key)
    const travel = track ? Math.hypot(track.toX - track.fromX, track.toZ - track.fromZ) : 0
    if (mesh.userData.role === "monster" && track && travel > 0.4) {
      aimFacing(mesh, Math.atan2(track.toZ - track.fromZ, track.toX - track.fromX))
    }
    const anim = mesh.userData.pose || {}
    anim.moving = travel > 0.4
    mesh.userData.pose = anim
    if (Number.isFinite(mesh.userData.fade) && card.material) card.material.opacity = mesh.userData.fade
    const frame = sheetRow(picture, anim, performance.now())
    // A 4-frame sheet has no death row. sheetRow still returns walk when death is 0.
    const row = Math.min(picture.frames - 1, Math.max(0, frame))
    const cell = cellOffset(column, row, picture.directions, picture.frames)
    card.material.map.offset.set(cell.x, cell.y)
    card.renderOrder = 0
    const rim = mesh.userData.rim
    if (!rim) return
    const away = {
      x: mesh.position.x - camera.position.x,
      y: mesh.position.y - camera.position.y,
      z: mesh.position.z - camera.position.z
    }
    const seat = rimSeat(picture.h, picture.rim.scale, away)
    rim.position.set(seat.x, seat.y, seat.z)
    rim.renderOrder = seat.renderOrder
    rim.material.map.offset.set(cell.x, cell.y)
  }

  function heroCard(picture) {
    const map = new THREE.DataTexture(picture.atlas, picture.atlasW, picture.atlasH, THREE.RGBAFormat)
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.colorSpace = THREE.SRGBColorSpace
    map.flipY = true
    map.wrapS = THREE.ClampToEdgeWrapping
    map.wrapT = THREE.ClampToEdgeWrapping
    map.repeat.set(1 / picture.directions, 1 / picture.frames)
    map.needsUpdate = true
    const material = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.4 })
    const card = new THREE.Sprite(material)
    card.center.set(0.5, 0)
    card.scale.set(picture.w, picture.h, 1)
    card.position.y = 0
    return card
  }

  function rimCard(picture, rim) {
    const bytes = new Uint8Array(picture.atlas)
    const red = (rim.color >> 16) & 255
    const green = (rim.color >> 8) & 255
    const blue = rim.color & 255
    for (let i = 0; i < bytes.length; i += 4) {
      if (!bytes[i + 3]) continue
      bytes[i] = red
      bytes[i + 1] = green
      bytes[i + 2] = blue
    }
    const map = new THREE.DataTexture(bytes, picture.atlasW, picture.atlasH, THREE.RGBAFormat)
    map.magFilter = THREE.NearestFilter
    map.minFilter = THREE.NearestFilter
    map.colorSpace = THREE.SRGBColorSpace
    map.flipY = true
    map.wrapS = THREE.ClampToEdgeWrapping
    map.wrapT = THREE.ClampToEdgeWrapping
    map.repeat.set(1 / picture.directions, 1 / picture.frames)
    map.needsUpdate = true
    const material = new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.4, depthWrite: false })
    const card = new THREE.Sprite(material)
    card.center.set(0.5, 0)
    card.scale.set(picture.w * rim.scale, picture.h * rim.scale, 1)
    card.renderOrder = 0
    return card
  }

  function buildHero(row, selfId) {
    const sig = heroSignature(row.hero)
    const group = new THREE.Group()
    const picture = sig.parts.find((part) => part.shape === "billboard")
    if (picture) {
      const card = heroCard(picture)
      group.add(card)
      group.userData.card = card
      group.userData.picture = picture
    } else {
      for (const piece of sig.parts) group.add(pieceMesh(piece))
    }
    if (!row.preview) {
      const top = sig.bounds.h + 4
      const plate = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(Math.max(22, sig.bounds.w * 0.45), 3, 2)), mat(0x1a100c))
      const fill = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(Math.max(20, sig.bounds.w * 0.4), 2, 2)), mat(0x7ea35a))
      plate.position.y = top
      fill.position.set(0, top, 1.2)
      group.add(plate, fill)
      group.userData.hp = fill
    }
    group.userData.face = true
    group.userData.role = "hero"
    group.userData.hero = row.hero
    group.userData.heroId = row.id
    group.userData.parts = picture ? picture.directions * picture.frames : sig.parts.length
    group.userData.marks = sig.marks.slice()
    group.userData.bounds = sig.bounds
    if (row.id === selfId && !picture) {
      const gold = new THREE.Mesh(
        trackGeometry(new THREE.BoxGeometry(sig.bounds.w + 4, 1.2, Math.min(sig.bounds.d, 22) + 4)),
        mat(0xf0c14a)
      )
      gold.position.y = 0.6
      group.add(gold)
    }
    group.add(contactDisc(16))
    return group
  }

  function groupFrom(parts) {
    const group = new THREE.Group()
    for (const piece of parts) group.add(pieceMesh(piece))
    return group
  }

  function buildingMesh(row) {
    const spec = sheetKinds[row.kind]
    const group = new THREE.Group()
    if (spec?.stand) {
      const card = new THREE.Sprite(sheetMats[row.kind])
      card.center.set(0.5, 0)
      card.scale.set(spec.w, spec.h, 1)
      card.renderOrder = 1
      group.add(card)
      if (row.kind === "house") {
        for (const [x, y] of [
          [-12, 20],
          [12, 20],
          [-12, 32],
          [12, 32],
          [-12, 44],
          [12, 44]
        ]) {
          const glow = new THREE.Sprite(windowMat)
          glow.center.set(0.5, 0.5)
          glow.scale.set(12, 8, 1)
          glow.position.set(x, y, 0)
          glow.renderOrder = 2
          group.add(glow)
        }
      }
    } else if (spec) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), sheetMats[row.kind])
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.42
      group.add(mesh)
    } else {
      for (const piece of modelParts(row.kind)) group.add(pieceMesh(piece))
    }
    const radius = { house: 22, field: 22, forge: 18, trap: 15, tower: 16, mage_tower: 18 }[row.kind] || 12
    group.add(contactDisc(radius))
    return group
  }

  function pieceMesh(piece) {
    const geometry = trackGeometry(
      piece.shape === "cone"
        ? new THREE.ConeGeometry(piece.w / 2, piece.h, piece.segments || 4)
        : piece.shape === "prism"
          ? new THREE.CylinderGeometry(piece.rt, piece.rb, piece.h, piece.segments || 5)
          : new THREE.BoxGeometry(piece.w, piece.h, piece.d)
    )
    const mapped = !piece.hold && stoneColors.has(piece.color)
    const mesh = new THREE.Mesh(
      geometry,
      piece.hold || litTokens.has(piece.color)
        ? new THREE.MeshBasicMaterial({ color: piece.color })
        : mapped
          ? stoneMat
          : mat(piece.color)
    )
    mesh.position.set(piece.x, piece.y, piece.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (piece.hold) {
      const shell = new THREE.Mesh(geometry, heroRim)
      shell.scale.set(1.12, 1.12, 1.12)
      shell.castShadow = false
      shell.receiveShadow = false
      mesh.add(shell)
    }
    return mesh
  }

  function applyFrame() {
    const rect = stage.getBoundingClientRect()
    const cssW = rect.width || stage.clientWidth || 480
    const cssH = rect.height || stage.clientHeight || 270
    viewFrame = picture.fit(renderer, camera, cssW, cssH, townRank)
  }

  function cullActors() {
    for (const [key, mesh] of meshes) {
      if (!key.startsWith("monster:") && !key.startsWith("hero:")) continue
      probe.set(mesh.position.x, 16, mesh.position.z).project(camera)
      mesh.visible = monsterVisible(probe.x, probe.y, probe.z)
    }
  }

  function visibleRims() {
    rimProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    rimFrustum.setFromProjectionMatrix(rimProj)
    let count = 0
    scene.traverse((node) => {
      const rim = node.userData && node.userData.rim
      if (!rim || !node.visible || !rim.visible) return
      rim.updateWorldMatrix(true, false)
      if (rimFrustum.intersectsSprite(rim)) count += 1
    })
    return count
  }

  function showRims(show) {
    scene.traverse((node) => {
      const rim = node.userData && node.userData.rim
      if (rim) rim.visible = show
    })
  }

  function publishPerf(paintMs) {
    const perf = window.__lastKeepPerf || (window.__lastKeepPerf = { paints: [] })
    perf.geometries = renderer.info.memory.geometries
    perf.textures = renderer.info.memory.textures
    perf.calls = renderer.info.render.calls
    perf.triangles = renderer.info.render.triangles
    perf.census = geometryCensus(scene)
    perf.rims = visibleRims()
    perf.submitMs = lastSubmit
    perf.driver = driverName()
    perf.tier = picture.tier
    if (paintMs == null) return
    perf.paints.push(paintMs)
    if (perf.paints.length > 400) perf.paints.shift()
  }

  function addBurst(x, z, color) {
    const mesh = takeBurst(color)
    mesh.position.set(x, 18, z)
    scene.add(mesh)
    bursts.push({ mesh, at: performance.now() })
  }

  function monsterMesh(row) {
    const parts = monsterParts(row.kind)
    const picture = parts.find((part) => part.shape === "billboard")
    const mesh = new THREE.Group()
    const card = heroCard(picture)
    const rim = picture.rim && picture.rim.scale > 1 ? rimCard(picture, picture.rim) : null
    if (rim) mesh.add(rim)
    mesh.add(card)
    mesh.userData.card = card
    mesh.userData.rim = rim
    mesh.userData.picture = picture
    mesh.userData.parts = picture.directions * picture.frames
    mesh.userData.span = { w: picture.w, h: picture.h, d: picture.d, y: picture.y, height: picture.h }
    mesh.userData.face = true
    if (row.kind === "bat") mesh.userData.lift = 22
    const plate = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(22, 4, 2)), mat(0x1a100c))
    const fill = new THREE.Mesh(trackGeometry(new THREE.BoxGeometry(20, 3, 2)), mat(0x7ea35a))
    plate.position.y = picture.h + 4
    fill.position.set(0, picture.h + 4, 1.2)
    mesh.add(plate, fill)
    mesh.userData.hp = fill
    mesh.userData.bar = plate
    const look = eliteLook(row)
    if (look === "plated" || look === "lean" || look === "spiked") {
      const markColor = look === "spiked" ? 0xf5751e : 0xd8cfc3
      const mark = new THREE.Mesh(
        trackGeometry(new THREE.BoxGeometry(5, 8, 5)),
        litTokens.has(markColor) ? new THREE.MeshBasicMaterial({ color: markColor }) : mat(markColor)
      )
      mark.position.y = picture.h + 10
      mesh.add(mark)
    }
    const spread = monsterSpread(row.id)
    mesh.userData.spread = spread
    mesh.userData.role = "monster"
    if (spread.bar && mesh.userData.hp && mesh.userData.bar) {
      mesh.userData.hp.position.y += spread.bar
      mesh.userData.bar.position.y += spread.bar
    }
    return mesh
  }
}

