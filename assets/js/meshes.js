import * as THREE from "three"

const spheres = new Map()
const burstPool = []
let burstGeometry = null

export function releaseGeometries(root) {
  if (!root || typeof root.traverse !== "function") return
  const seen = new Set()
  root.traverse((node) => {
    const geometry = node.geometry
    if (!geometry || seen.has(geometry) || geometry.userData.pooled) return
    seen.add(geometry)
    geometry.dispose()
  })
}

export function shotSphere(radius) {
  let geometry = spheres.get(radius)
  if (!geometry) {
    geometry = new THREE.SphereGeometry(radius, 6, 5)
    geometry.userData.pooled = true
    spheres.set(radius, geometry)
  }
  return geometry
}

function burstSphere() {
  if (!burstGeometry) {
    burstGeometry = new THREE.SphereGeometry(8, 6, 5)
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
