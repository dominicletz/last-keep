import * as THREE from "three"

const spheres = new Map()
const burstPool = []
const tracked = new Set()
const flightRoles = new Set(["shot", "burst", "spawn"])

export function trackGeometry(geometry) {
  if (!geometry || tracked.has(geometry)) return geometry
  tracked.add(geometry)
  geometry.addEventListener("dispose", () => tracked.delete(geometry))
  return geometry
}

export function geometryCensus(root) {
  const inScene = new Set()
  const byRole = {}
  let settled = 0
  if (root && typeof root.traverse === "function") {
    root.traverse((node) => {
      const geometry = node.geometry
      if (!geometry || inScene.has(geometry)) return
      inScene.add(geometry)
      let role = "world"
      let cursor = node
      while (cursor) {
        if (cursor.userData && cursor.userData.role) {
          role = cursor.userData.role
          break
        }
        cursor = cursor.parent
      }
      const copies = node.isInstancedMesh && role === "portal" ? node.count || 0 : 1
      if (copies === 0) return
      byRole[role] = (byRole[role] || 0) + copies
      if (!flightRoles.has(role)) settled += copies
    })
  }
  let orphans = 0
  let pooled = 0
  for (const geometry of tracked) {
    if (geometry.userData.pooled) {
      pooled += 1
      continue
    }
    if (!inScene.has(geometry)) orphans += 1
  }
  return { inScene: inScene.size, orphans, pooled, byRole, settled }
}

export function releaseGeometries(root) {
  if (!root || typeof root.traverse !== "function") return
  const seen = new Set()
  root.traverse((node) => {
    const geometry = node.geometry
    // Each card uploads its own atlas. The plane itself is shared, so disposing it blanks every card.
    if (node.isSprite && node.material) {
      const map = node.material.map
      node.material.dispose()
      if (map) map.dispose()
    }
    // A sheet card owns a clone of the shared sheet texture; dropping the clone
    // leaves the shared image for the other cards.
    if (node.isMesh && node.userData.ownsMap && node.material) {
      if (node.material.map) node.material.map.dispose()
      node.material.dispose()
    }
    if (!geometry || seen.has(geometry) || geometry.userData.pooled || node.isSprite) return
    seen.add(geometry)
    geometry.dispose()
  })
}

export function shotSphere(radius) {
  let geometry = spheres.get(radius)
  if (!geometry) {
    geometry = trackGeometry(new THREE.SphereGeometry(radius, 6, 5))
    geometry.userData.pooled = true
    spheres.set(radius, geometry)
  }
  return geometry
}

export function takeBurst(kind) {
  let mesh = burstPool.pop()
  if (mesh) {
    mesh.userData.kind = kind
    mesh.visible = true
  } else {
    mesh = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.4, depthWrite: false })
    )
    mesh.center.set(0.5, 0.5)
    mesh.userData.role = "burst"
    mesh.userData.kind = kind
  }
  return mesh
}

export function giveBurst(mesh) {
  mesh.visible = false
  burstPool.push(mesh)
}
