import * as THREE from "three"

const spheres = new Map()
const burstPool = []
const tracked = new Set()
let burstGeometry = null

export function trackGeometry(geometry) {
  if (!geometry || tracked.has(geometry)) return geometry
  tracked.add(geometry)
  geometry.addEventListener("dispose", () => tracked.delete(geometry))
  return geometry
}

export function geometryCensus(root) {
  const inScene = new Set()
  const byRole = {}
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
      byRole[role] = (byRole[role] || 0) + 1
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
  return { inScene: inScene.size, orphans, pooled, byRole }
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

function burstSphere() {
  if (!burstGeometry) {
    burstGeometry = trackGeometry(new THREE.SphereGeometry(8, 6, 5))
    burstGeometry.userData.pooled = true
  }
  return burstGeometry
}

export function takeBurst(color) {
  const mesh = burstPool.pop()
  if (mesh) {
    mesh.material.color.set(color)
    mesh.material.opacity = 0.9
    mesh.scale.setScalar(1)
    mesh.visible = true
    return mesh
  }
  return new THREE.Mesh(
    burstSphere(),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  )
}

export function giveBurst(mesh) {
  mesh.visible = false
  burstPool.push(mesh)
}
