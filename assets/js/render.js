import * as THREE from "three"
import { present } from "./present"
import { eliteLook } from "./elite"
import { frameFor } from "./frame"
import { poseAt } from "./motion"
import { sceneryForest } from "./scenery"
import { zoomFor } from "./town"

const HERO_COLOR = {
  warrior: 0x8e99a6,
  mage: 0x2c4f86,
  scout: 0x2f6a3a,
  farmer: 0xc4a15a,
  engineer: 0x8a5a32
}

const MONSTER_COLOR = {
  goblin: 0xff3a22,
  skeleton: 0xe8e0d0,
  wolf: 0x2c3344,
  troll: 0x2f6a32,
  boss: 0x6a3a8a
}

const BUILDING_COLOR = {
  wall: 0x6b4228,
  tower: 0x6e675c,
  trap: 0x8a8174,
  field: 0xc6b04a,
  forge: 0xa84828,
  mage_tower: 0x3a4f86
}

export function createView(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
  renderer.setSize(480, 270, false)
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.BasicShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  stage.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8a4030)
  scene.fog = new THREE.Fog(0x8a4030, 900, 2400)

  const opening = frameFor(stage.clientWidth || 480, stage.clientHeight || 270)
  const camera = new THREE.OrthographicCamera(opening.left, opening.right, opening.top, opening.bottom, 0.1, 2400)
  let viewFrame = opening
  let townRank = 0

  scene.add(new THREE.HemisphereLight(0xffb070, 0x24361c, 1.15))
  const ambient = new THREE.AmbientLight(0xffd2a4, 1.55)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xffa050, 2.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
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
    mat(0x4f7a3a)
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const dirt = new THREE.Mesh(new THREE.CircleGeometry(150, 8), mat(0x8d6844))
  dirt.rotation.x = -Math.PI / 2
  dirt.position.y = 0.2
  dirt.receiveShadow = true
  scene.add(dirt)

  forest()
  const keep = makeKeep()
  scene.add(keep)

  const meshes = new Map()
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(30, 22, 12),
    new THREE.MeshBasicMaterial({ color: 0x7ea35a, transparent: true, opacity: 0.55 })
  )
  ghost.position.y = 11
  ghost.visible = false
  scene.add(ghost)
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

  function forest() {
    const look = sceneryForest()
    const dummy = new THREE.Object3D()
    if (look.parts.includes("trunk")) {
      const trunk = new THREE.CylinderGeometry(3.2, 4.6, 28, 5)
      const trunks = new THREE.InstancedMesh(trunk, mat(look.trunk), look.count)
      for (let i = 0; i < look.count; i++) {
        const angle = i * 2.4
        const dist = 300 + (i % 8) * 36
        dummy.position.set(Math.cos(angle) * dist, 14, Math.sin(angle) * dist)
        dummy.scale.setScalar(0.85 + (i % 3) * 0.2)
        dummy.rotation.set(0, angle, 0)
        dummy.updateMatrix()
        trunks.setMatrixAt(i, dummy.matrix)
      }
      trunks.castShadow = true
      scene.add(trunks)
    }
  }

  function makeKeep() {
    const group = new THREE.Group()
    const base = box(70, 28, 70, 0x6e675c, 0, 14, 0)
    const tower = box(28, 70, 28, 0x7d756a, 0, 48, 0)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(22, 28, 4), mat(0x8a3d2f))
    roof.position.y = 92
    roof.castShadow = true
    const door = box(16, 18, 4, 0x3a2418, 0, 10, 36)
    const window = box(6, 8, 4, 0xffb15a, 0, 58, 14)
    window.material = mat(0xffb15a, 0xff7a2a)
    group.add(base, tower, roof, door, window)
    const torch = new THREE.PointLight(0xff9a3c, 8, 160)
    torch.position.set(20, 24, 30)
    group.add(torch)
    return group
  }

  function box(w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
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
      const pose = smoothed(key)
      mesh.position.set(pose.x, mesh.userData.lift || 0, pose.z)
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

  function figure(color, scale, weapon, emissive = 0x000000) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(12 * scale, 16 * scale, 8 * scale), mat(color, emissive))
    body.position.y = 12 * scale
    body.castShadow = true
    const head = new THREE.Mesh(new THREE.BoxGeometry(8 * scale, 8 * scale, 8 * scale), mat(0xf0d2b0))
    head.position.y = 24 * scale
    head.castShadow = true
    group.add(body, head)
    if (weapon) group.add(weapon)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(22, 4, 2), mat(0x1a100c))
    const fill = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 2), mat(0x7ea35a))
    plate.position.y = 36 * scale
    fill.position.set(0, 36 * scale, 1.2)
    group.add(plate, fill)
    group.userData.hp = fill
    group.userData.face = true
    return group
  }

  return {
    canvas: renderer.domElement,
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
      townRank = snap.town || 0
      applyFrame()
      const zoom = zoomFor(snap)
      const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
      const anchorX = me ? me.x * 0.22 : 0
      const anchorZ = me ? me.y * 0.22 : 0
      focus.set(anchorX, 0, anchorZ)
      const dist = zoom.camera
      dirt.scale.setScalar(zoom.dirt / 150)
      camera.position.set(focus.x + dist, dist * 0.9, focus.z + dist)
      camera.lookAt(focus.x, 0, focus.z)
      sun.position.set(focus.x + 90, 200, focus.z + 30)
      sun.target.position.copy(focus)

      const keepRatio = snap.keep.max ? snap.keep.hp / snap.keep.max : 1
      keep.scale.y = 0.65 + keepRatio * 0.35

      const drawn = present(snap)

      sync("hero", drawn.heroes, (row) => {
        const weapon = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 4), mat(0xd8d2c4))
        weapon.position.set(10, 14, 0)
        weapon.castShadow = true
        const mesh = figure(HERO_COLOR[row.hero] || 0x888888, row.hero === "warrior" ? 1.15 : 1, weapon)
        mesh.userData.role = "hero"
        if (row.id === selfId) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 28), mat(0xf0c14a))
          plate.position.y = 0.6
          mesh.add(plate)
        }
        return mesh
      })

      liveMonsters = snap.monsters || []

      sync("monster", drawn.monsters, (row) => monsterMesh(row))

      sync("building", drawn.buildings, (row) => {
        const group = new THREE.Group()
        if (row.kind === "wall") group.add(boxMesh(30, 22, 12, BUILDING_COLOR.wall, 11))
        else if (row.kind === "tower") {
          group.add(boxMesh(22, 36, 22, BUILDING_COLOR.tower, 18))
          const flame = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), mat(0xffb15a, 0xff6a1a))
          flame.position.y = 40
          group.add(flame)
        } else if (row.kind === "trap") group.add(boxMesh(22, 6, 22, BUILDING_COLOR.trap, 3))
        else if (row.kind === "field") {
          const patch = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 30), mat(BUILDING_COLOR.field))
          patch.position.y = 1
          group.add(patch)
        } else if (row.kind === "forge") group.add(boxMesh(28, 24, 28, BUILDING_COLOR.forge, 12))
        else group.add(boxMesh(26, 40, 26, BUILDING_COLOR.mage_tower, 20))
        return group
      })

      sync("tree", snap.trees || [], () => {
        const group = new THREE.Group()
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 12, 5), mat(0x5a3a22))
        trunk.position.y = 6
        trunk.castShadow = true
        const crown = new THREE.Mesh(new THREE.ConeGeometry(14, 28, 5), mat(0x2f6a3c))
        crown.position.y = 24
        crown.castShadow = true
        group.add(trunk, crown)
        return group
      })

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

      renderer.render(scene, camera)
      const counts = { heroes: 0, monsters: 0, shots: 0 }
      scene.traverse((object) => {
        if (object.userData?.role === "hero") counts.heroes += 1
        if (object.userData?.role === "monster") counts.monsters += 1
        if (object.userData?.role === "shot") counts.shots += 1
      })
      const monsters = (snap.monsters || []).map((monster) => {
        const point = new THREE.Vector3(monster.x, 16, monster.y).project(camera)
        return {
          id: monster.id,
          kind: monster.kind,
          x: monster.x,
          y: monster.y,
          onScreen: Math.abs(point.x) < 0.72 && Math.abs(point.y) < 0.62 && point.z < 1
        }
      })
      heroKey = me ? `hero:${me.id}` : null
      const heroMesh = heroKey ? meshes.get(heroKey) : null
      window.__lastKeep = {
        counts,
        phase: snap.phase,
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
        buildings: (snap.buildings || []).length,
        projectiles: snap.projectiles || [],
        relics: snap.relics || [],
        forge: !!snap.forge,
        mageTower: !!snap.mage_tower,
        shownWave: snap.shown_wave,
        smoothing: true,
        rendered: heroMesh ? { x: heroMesh.position.x, z: heroMesh.position.z } : null,
        frame: {
          aspect: camera.right / camera.top,
          bufferWidth: renderer.domElement.width,
          bufferHeight: renderer.domElement.height,
          halfW: viewFrame.halfW,
          halfH: viewFrame.halfH
        },
        toClient,
        redNear
      }
    },
    ghost(kind, x, z, ok) {
      ghost.visible = !!kind
      if (!kind) return
      ghost.position.set(x, 11, z)
      ghost.material.color.set(ok ? 0x7ea35a : 0xc84b3a)
    }
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
    const point = new THREE.Vector3(x, 16, z).project(camera)
    const canvas = renderer.domElement
    const px = Math.round((point.x * 0.5 + 0.5) * canvas.width)
    const py = Math.round((-point.y * 0.5 + 0.5) * canvas.height)
    const copy = document.createElement("canvas")
    copy.width = canvas.width
    copy.height = canvas.height
    const ctx = copy.getContext("2d", { willReadFrequently: true })
    ctx.drawImage(canvas, 0, 0)
    const size = 17
    const sx0 = Math.max(0, px - 8)
    const sy0 = Math.max(0, py - 8)
    const block = ctx.getImageData(sx0, sy0, Math.min(size, copy.width - sx0), Math.min(size, copy.height - sy0))
    let count = 0
    for (let i = 0; i < block.data.length; i += 4) {
      const r = block.data[i]
      const g = block.data[i + 1]
      const b = block.data[i + 2]
      if (r > 150 && r > g + 40 && r > b + 20) count += 1
    }
    return count
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
    let mesh
    const look = eliteLook(row)
    if (look === "horned") mesh = bossMesh()
    else if (look === "plated") mesh = platedMesh()
    else if (look === "lean") mesh = leanMesh()
    else if (look === "spiked") mesh = spikedMesh()
    else {
      const scale = row.kind === "troll" ? 2.1 : row.kind === "wolf" ? 1.7 : 2.2
      const emissive = row.kind === "goblin" ? 0x6a1408 : 0x000000
      mesh = figure(MONSTER_COLOR[row.kind] || 0xff3a22, scale, null, emissive)
      if (row.kind === "wolf") mesh.scale.z = 1.6
    }
    mesh.userData.role = "monster"
    return mesh
  }

  function bossMesh() {
    const group = figure(0x4a2068, 2.8, null, 0x2a0840)
    const horn = new THREE.Mesh(new THREE.ConeGeometry(3, 16, 4), mat(0xf2e2b0))
    horn.position.set(-7, 46, 0)
    const other = horn.clone()
    other.position.x = 7
    group.add(horn, other)
    return group
  }

  function platedMesh() {
    const group = figure(0x8a9098, 2.2, null, 0x222428)
    group.add(boxMesh(8, 18, 4, 0xd5d8de, 10))
    return group
  }

  function leanMesh() {
    const group = figure(0xffb15a, 1.7, null, 0x6a3a08)
    group.scale.z = 0.65
    return group
  }

  function spikedMesh() {
    const group = figure(0xff3a22, 2.3, null, 0x6a1408)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2, 12, 4), mat(0xffe08a, 0xff7a2a))
    spike.position.set(0, 36, 0)
    group.add(spike)
    return group
  }

  function frame() {
    const now = performance.now()
    for (const [key, mesh] of meshes) {
      const pose = smoothed(key)
      mesh.position.x = pose.x
      mesh.position.z = pose.z
    }
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
    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

function boxMesh(w, h, d, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  )
  mesh.position.y = y
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
