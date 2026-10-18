export function sceneryForest() {
  const layers = [
    { dist: 320, count: 24, scale: 0.82 },
    { dist: 430, count: 24, scale: 1.08 },
    { dist: 560, count: 22, scale: 1.4 }
  ]
  return {
    count: layers.reduce((sum, layer) => sum + layer.count, 0),
    layers,
    parts: ["stump", "log"],
    wood: 0,
    radiusBottom: 12
  }
}

export function scenerySlots() {
  const look = sceneryForest()
  const slots = []
  look.layers.forEach((layer, layerIndex) => {
    for (let n = 0; n < layer.count; n++) {
      const angle = (n / layer.count) * Math.PI * 2 + layerIndex * 0.41
      slots.push({
        x: Math.cos(angle) * layer.dist,
        y: 0,
        z: Math.sin(angle) * layer.dist,
        scale: layer.scale
      })
    }
  })
  return slots
}
