import * as THREE from "three"
import { present } from "./present"

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
  scene.fog = new THREE.Fog(0x8a4030, 760, 1500)

  const aspect = 480 / 270
  const view = 140
  const camera = new THREE.OrthographicCamera(-view * aspect, view * aspect, view, -view, 0.1, 2400)

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
    new THREE.CircleGeometry(1100, 8),
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

  function forest() {
    const cone = new THREE.ConeGeometry(18, 46, 5)
    const trunk = new THREE.CylinderGeometry(3, 4, 12, 5)
    const leaves = new THREE.InstancedMesh(cone, mat(0x2f6a3c), 70)
    const trunks = new THREE.InstancedMesh(trunk, mat(0x6a4428), 70)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 70; i++) {
      const angle = i * 2.4
      const dist = 300 + (i % 8) * 36
      dummy.position.set(Math.cos(angle) * dist, 20, Math.sin(angle) * dist)
      dummy.scale.setScalar(0.8 + (i % 3) * 0.25)
      dummy.updateMatrix()
      leaves.setMatrixAt(i, dummy.matrix)
      dummy.position.y = 6
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
    }
    leaves.castShadow = true
    scene.add(leaves)
    scene.add(trunks)
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
      mesh.position.set(row.x, 0, row.y)
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
    const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 2), mat(0xc84b3a))
    bar.position.y = 34 * scale
    group.add(bar)
    group.userData.hp = bar
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
      if (nearest) return { x: nearest.x, y: nearest.y }
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      return { x: hit.x, y: hit.z }
    },
    project(x, z) {
      const point = new THREE.Vector3(x, 8, z).project(camera)
      return { x: point.x, y: point.y, behind: point.z > 1 }
    },
    draw(snap, selfId) {
      const me = (snap.players || []).find((player) => player.id === selfId) || snap.players?.[0]
      const anchorX = me ? me.x * 0.22 : 0
      const anchorZ = me ? me.y * 0.22 : 0
      focus.set(anchorX, 0, anchorZ)
      const dist = 150
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
        return mesh
      })

      liveMonsters = snap.monsters || []

      sync("monster", drawn.monsters, (row) => {
        const scale = row.kind === "boss" ? 2.6 : row.kind === "troll" ? 2.1 : row.kind === "wolf" ? 1.7 : 2.2
        const emissive = row.kind === "goblin" || row.kind === "boss" ? 0x6a1408 : 0x000000
        const mesh = figure(MONSTER_COLOR[row.kind] || 0xff3a22, scale, null, emissive)
        if (row.kind === "wolf") mesh.scale.z = 1.6
        mesh.userData.role = "monster"
        return mesh
      })

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
        const color = row.kind === "fireball" || row.kind === "meteor" ? 0xff7a2a : 0xf2e2b0
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), mat(color, color))
        mesh.position.y = row.kind === "meteor" ? 30 : 10
        return mesh
      })

      renderer.render(scene, camera)
      const counts = { heroes: 0, monsters: 0 }
      scene.traverse((object) => {
        if (object.userData?.role === "hero") counts.heroes += 1
        if (object.userData?.role === "monster") counts.monsters += 1
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
      window.__lastKeep = {
        counts,
        phase: snap.phase,
        hold: !!snap.hold,
        wave: snap.wave,
        keep: snap.keep,
        wood: snap.resources?.wood,
        kills: snap.kills,
        self: me ? { x: me.x, y: me.y, name: me.name, hero: me.hero, host: me.host, range: me.range } : null,
        monsters,
        buildings: (snap.buildings || []).length,
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
