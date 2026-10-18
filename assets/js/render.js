import * as THREE from "three"
import { present } from "./present"
import { eliteLook } from "./elite"
import { cameraFocus, drawDue, frameFor } from "./frame"
import { poseAt } from "./motion"
import { sceneryForest, scenerySlots } from "./scenery"
import { zoomFor } from "./town"
import { monsterVisible } from "./cull"
import { heroSignature } from "./heroes"
import { keepParts, modelBounds, modelParts } from "../models/registry.js"
import { monsterRim, monsterSpread } from "./bodies"
import { rangeRingState } from "./hud"
import { absorbShots, bodyPixel, partyPositions } from "./paint.js"
import { cycleLight, groundColor, lightName, lumaOf, patchStats, pathColor, plazaColor, ringColor, skyColor, yardLight } from "./scene.js"

export function createView(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false })
  renderer.setSize(480, 270, false)
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.BasicShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(skyColor)
  scene.fog = new THREE.Fog(skyColor, 900, 2400)

  const opening = frameFor(stage.clientWidth || 480, stage.clientHeight || 270)
  const camera = new THREE.OrthographicCamera(opening.left, opening.right, opening.top, opening.bottom, 0.1, 2400)
  const probe = new THREE.Vector3()
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
    new THREE.CircleGeometry(1900, 8),
    mat(groundColor)
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(150, 8), mat(plazaColor))
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.2
  plaza.receiveShadow = true
  const ring = new THREE.Mesh(new THREE.RingGeometry(146, 168, 8), mat(ringColor))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.28
  ring.receiveShadow = true
  scene.add(plaza, ring)
  const pathNS = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 280), mat(pathColor))
  pathNS.position.y = 0.4
  const pathEW = new THREE.Mesh(new THREE.BoxGeometry(280, 0.45, 18), mat(pathColor))
  pathEW.position.y = 0.35
  scene.add(pathNS, pathEW)

  forest()
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
  const darkOutline = new THREE.MeshLambertMaterial({ color: 0x140c0a, side: THREE.BackSide })
  const boneOutline = new THREE.MeshBasicMaterial({ color: 0x908b8a, side: THREE.BackSide })
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

  function forest() {
    const look = sceneryForest()
    const slots = scenerySlots()
    if (!look.parts.includes("trunk") || slots.length === 0) return
    const dummy = new THREE.Object3D()
    const trunk = new THREE.CylinderGeometry(look.radiusTop, look.radiusBottom, look.height, look.segments)
    const trunks = new THREE.InstancedMesh(trunk, mat(look.trunk), slots.length)
    slots.forEach((slot, i) => {
      dummy.position.set(slot.x, slot.y, slot.z)
      dummy.scale.set(slot.scale, slot.scale, slot.scale)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
    })
    trunks.castShadow = false
    trunks.receiveShadow = false
    scene.add(trunks)
  }

  function forestState() {
    const look = sceneryForest()
    return {
      trunks: scenerySlots().length,
      wood: look.wood,
      crowns: look.parts.includes("crown") || look.parts.includes("bough"),
      treeBoughs: modelParts("tree").filter((part) => part.name === "bough").length
    }
  }

  function makeKeep(rank) {
    const group = new THREE.Group()
    group.userData.rank = rank
    for (const piece of keepParts(rank)) group.add(pieceMesh(piece))
    const torch = new THREE.PointLight(0xeea821, 8, 220)
    torch.position.set(22, 40, 22)
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
      if (!mesh) {
        mesh = build(row)
        meshes.set(key, mesh)
        scene.add(mesh)
      }
      remember(key, row.x, row.y)
      placeMesh(key, mesh)
      if (mesh.userData.face && Number.isFinite(row.facing)) mesh.rotation.y = -row.facing
      if (mesh.userData.hp) {
        const ratio = row.max ? row.hp / row.max : 1
        mesh.userData.hp.scale.x = Math.max(ratio, 0.05)
      }
    }
    for (const [key, mesh] of meshes) {
      if (key.startsWith(`${kind}:`) && !seen.has(key)) {
        scene.remove(mesh)
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

  function noteInput() {
    lastInput = performance.now()
  }

  function paintFrame() {
    renderer.render(scene, camera)
    renders += 1
    fieldSample = sampleYard(renderer.getContext(), renderer.domElement)
    if (window.__lastKeep) {
      window.__lastKeep.renders = renders
      window.__lastKeep.field = fieldSample
    }
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
    for (const [x, y] of spots) {
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf)
      const stats = patchStats(buf)
      if (!best || stats.variance < best.variance) best = stats
    }
    return best ? { ...best, light: liveLight } : null
  }

  window.addEventListener("pointerdown", noteInput)
  window.addEventListener("keydown", noteInput)

  function frame() {
    const now = performance.now()
    // The socket handler only queues. Drawing here lets the test's wait run
    // between snapshots. A draw inside the handler piles up and the page
    // never returns, so the fireball wait dies when the browser closes.
    if (pending && viewApi && pending.snap.tick !== drawnTick && drawDue(now, lastRender, lastInput)) {
      viewApi.draw(pending.snap, pending.selfId)
      drawnTick = pending.snap.tick
    }
    for (const [key, mesh] of meshes) placeMesh(key, mesh)
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i]
      const age = (now - burst.at) / 520
      if (age >= 1) {
        scene.remove(burst.mesh)
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
    for (const [key, mesh] of meshes) {
      if (!key.startsWith("monster:") && !key.startsWith("hero:")) continue
      probe.set(mesh.position.x, 16, mesh.position.z).project(camera)
      mesh.visible = monsterVisible(probe.x, probe.y, probe.z)
    }
    if (drawDue(now, lastRender, lastInput)) {
      paintFrame()
      lastRender = now
    }
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)

  viewApi = {
    canvas: renderer.domElement,
    queue(snap, selfId) {
      pending = { snap, selfId }
      placeCamera(snap, selfId)
      nudge(snap, selfId)
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
      const rig = cycleLight[name]
      if (keep.userData.torch) keep.userData.torch.intensity = rig.torch
      sky.color.set(rig.sky)
      sky.groundColor.set(rig.ground)
      sky.intensity = rig.hemisphere
      ambient.color.set(rig.ambient)
      ambient.intensity = rig.ambientLevel
      sun.color.set(rig.sun)
      sun.intensity = rig.sunLevel
      scene.background.set(rig.background)
      scene.fog.color.set(rig.background)
      townRank = snap.town || 0
      applyFrame()
      const zoom = zoomFor(snap)
      const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
      const anchor = cameraFocus(me?.x, me?.y)
      focus.set(anchor.x, 0, anchor.z)
      const dist = zoom.camera
      const yardScale = zoom.dirt / 150
      plaza.scale.setScalar(yardScale)
      ring.scale.setScalar(yardScale)
      const pathSpan = yardScale
      pathNS.scale.set(1, 1, pathSpan)
      pathEW.scale.set(pathSpan, 1, 1)
      if (keep.userData.rank !== townRank) {
        scene.remove(keep)
        keep = makeKeep(townRank)
        scene.add(keep)
      }
      camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
      camera.lookAt(focus.x, 0, focus.z)
      sun.position.set(focus.x + 90, 200, focus.z + 30)
      sun.target.position.copy(focus)

      const keepRatio = snap.keep.max ? snap.keep.hp / snap.keep.max : 1
      keep.scale.y = 0.65 + keepRatio * 0.35

      const drawn = present(snap)

      if (me) bearer = { x: me.x, z: me.y, range: me.range || bearer.range }

      sync("hero", drawn.heroes, (row) => buildHero(row, selfId))

      liveMonsters = snap.monsters || []

      sync("monster", drawn.monsters, (row) => monsterMesh(row))

      sync("building", drawn.buildings, (row) => groupFrom(modelParts(row.kind)))

      sync("tree", snap.trees || [], () => groupFrom(modelParts("tree")))

      sync("shot", snap.projectiles || [], (row) => {
        const fire = row.kind === "fireball" || row.kind === "meteor"
        const color = fire ? 0xff7a2a : 0xf2e2b0
        const size = row.kind === "fireball" ? 11 : row.kind === "meteor" ? 14 : 6
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), mat(color, color))
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
        figures.push({
          id: key.slice(5),
          hero: mesh.userData.hero,
          parts: mesh.userData.parts,
          marks: mesh.userData.marks,
          bounds: mesh.userData.bounds
        })
      }
      heroKey = me ? `hero:${me.id}` : null
      const heroMesh = heroKey ? meshes.get(heroKey) : null
      window.__lastKeep = {
        counts,
        phase: snap.phase,
        light: lightName(snap),
        field: fieldSample,
        hold: !!snap.hold,
        wave: snap.wave,
        keep: snap.keep,
        wood: snap.resources?.wood,
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
              attackCd: me.cds?.attack || 0
            }
          : null,
        attackCd: me?.cds?.attack || 0,
        cds: me?.cds || null,
        monsters,
        figures,
        rangeRing: rangeRingState(rangeRing.visible, bearer.range),
        buildings: (snap.buildings || []).length,
        projectiles: snap.projectiles || [],
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
          path: true,
          bestiary: ["goblin", "skeleton", "wolf", "troll", "bat", "boss"]
        },
        forestLook,
        rendered: heroMesh ? { x: heroMesh.position.x, z: heroMesh.position.z } : null,
        frame: {
          aspect: camera.right / camera.top,
          bufferWidth: renderer.domElement.width,
          bufferHeight: renderer.domElement.height,
          halfW: viewFrame.halfW,
          halfH: viewFrame.halfH
        },
        renders,
        toClient,
        redNear,
        brightNear,
        tick: snap.tick,
        alive: me ? !!me.alive : !!kept.alive,
        hp: me ? me.hp : kept.hp,
        party: partyPositions(snap.players),
        kinds: absorbShots(kept.kinds, snap.projectiles),
        log: kept.log || [],
        labels: kept.labels || [],
        audio: kept.audio
      }
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
      if (mesh.userData.face && Number.isFinite(row.facing)) mesh.rotation.y = -row.facing
    }
    for (const row of snap.monsters || []) {
      if (!meshes.has(`monster:${row.id}`)) continue
      remember(`monster:${row.id}`, row.x, row.y)
    }
  }

  function placeCamera(snap, selfId) {
    const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
    const anchor = cameraFocus(me?.x, me?.y)
    focus.set(anchor.x, 0, anchor.z)
    const dist = zoomFor(snap).camera
    camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
    camera.lookAt(focus.x, 0, focus.z)
    camera.updateMatrixWorld(true)
  }

  function toClient(x, z) {
    const point = new THREE.Vector3(x, 16, z).project(camera)
    const rect = renderer.domElement.getBoundingClientRect()
    return {
      x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-point.y * 0.5 + 0.5) * rect.height
    }
  }

  function redNear(x, z) {
    paintFrame()
    const gl = renderer.getContext()
    const point = new THREE.Vector3(x, 16, z).project(camera)
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

  function brightNear(x, z, height = 16) {
    paintFrame()
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
    tracks.set(key, {
      fromX: prev ? prev.toX : x,
      fromZ: prev ? prev.toZ : z,
      toX: x,
      toZ: z,
      at: performance.now()
    })
  }

  function smoothed(key) {
    return poseAt(tracks.get(key), performance.now(), 45)
  }

  function placeMesh(key, mesh) {
    const pose = smoothed(key)
    const spread = mesh.userData.spread || { x: 0, z: 0 }
    mesh.position.set(pose.x + spread.x, mesh.userData.lift || 0, pose.z + spread.z)
  }

  function buildHero(row, selfId) {
    const sig = heroSignature(row.hero)
    const group = new THREE.Group()
    for (const piece of sig.parts) group.add(pieceMesh(piece))
    const top = sig.bounds.h + 4
    const plate = new THREE.Mesh(new THREE.BoxGeometry(Math.max(22, sig.bounds.w * 0.45), 3, 2), mat(0x1a100c))
    const fill = new THREE.Mesh(new THREE.BoxGeometry(Math.max(20, sig.bounds.w * 0.4), 2, 2), mat(0x7ea35a))
    plate.position.y = top
    fill.position.set(0, top, 1.2)
    group.add(plate, fill)
    group.userData.hp = fill
    group.userData.face = true
    group.userData.role = "hero"
    group.userData.hero = row.hero
    group.userData.parts = sig.parts.length
    group.userData.marks = sig.marks.slice()
    group.userData.bounds = sig.bounds
    if (row.id === selfId) {
      const gold = new THREE.Mesh(
        new THREE.BoxGeometry(sig.bounds.w + 4, 1.2, Math.min(sig.bounds.d, 22) + 4),
        mat(0xf0c14a)
      )
      gold.position.y = 0.6
      group.add(gold)
    }
    return group
  }

  function groupFrom(parts) {
    const group = new THREE.Group()
    for (const piece of parts) group.add(pieceMesh(piece))
    return group
  }

  function pieceMesh(piece) {
    const geometry =
      piece.shape === "cone"
        ? new THREE.ConeGeometry(piece.w / 2, piece.h, piece.segments || 4)
        : piece.shape === "prism"
          ? new THREE.CylinderGeometry(piece.rt, piece.rb, piece.h, piece.segments || 5)
          : new THREE.BoxGeometry(piece.w, piece.h, piece.d)
    const mesh = new THREE.Mesh(geometry, mat(piece.color))
    mesh.position.set(piece.x, piece.y, piece.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  function applyFrame() {
    const rect = stage.getBoundingClientRect()
    const next = frameFor(rect.width || stage.clientWidth || 480, rect.height || stage.clientHeight || 270, townRank)
    const unchanged =
      viewFrame.bufferWidth === next.bufferWidth &&
      viewFrame.bufferHeight === next.bufferHeight &&
      viewFrame.halfW === next.halfW &&
      renderer.domElement.width === next.bufferWidth
    viewFrame = next
    if (unchanged) return
    renderer.setSize(next.bufferWidth, next.bufferHeight, false)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    camera.left = next.left
    camera.right = next.right
    camera.top = next.top
    camera.bottom = next.bottom
    camera.updateProjectionMatrix()
  }

  function addBurst(x, z, color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 6, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    )
    mesh.position.set(x, 18, z)
    scene.add(mesh)
    bursts.push({ mesh, at: performance.now() })
  }

  function monsterMesh(row) {
    const bounds = modelBounds(row.kind)
    const mesh = groupFrom(modelParts(row.kind))
    mesh.userData.span = bounds
    mesh.userData.face = true
    if (row.kind === "bat") mesh.userData.lift = 22
    const plate = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 2), mat(0x1a100c))
    const fill = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), mat(0x7ea35a))
    plate.position.y = bounds.height + 4
    fill.position.set(0, bounds.height + 4, 1.2)
    mesh.add(plate, fill)
    mesh.userData.hp = fill
    mesh.userData.bar = plate
    const look = eliteLook(row)
    if (look === "plated" || look === "lean" || look === "spiked") {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 5), mat(look === "spiked" ? 0xf5751e : 0xd8cfc3))
      mark.position.y = bounds.height + 10
      mesh.add(mark)
    }
    const spread = monsterSpread(row.id)
    mesh.userData.spread = spread
    mesh.userData.role = "monster"
    const scale = mesh.userData.bodyScale || 1
    const span = mesh.userData.span
    const rim = monsterRim(row.kind)
    const grow = rim.scale
    const halo = new THREE.Mesh(
      span
        ? new THREE.BoxGeometry(span.w * grow, span.h * grow, span.d * grow)
        : new THREE.BoxGeometry(15 * scale * grow, 22 * scale * grow, 11 * scale * grow),
      grow > 1 ? boneOutline : darkOutline
    )
    halo.position.y = span ? span.y : 14 * scale
    mesh.add(halo)
    if (spread.bar && mesh.userData.hp && mesh.userData.bar) {
      mesh.userData.hp.position.y += spread.bar
      mesh.userData.bar.position.y += spread.bar
    }
    return mesh
  }
}

