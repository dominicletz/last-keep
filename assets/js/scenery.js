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

const WALL_GAP = 0.22

function angleGap(left, right) {
  const span = Math.abs(left - right) % (Math.PI * 2)
  return Math.min(span, Math.PI * 2 - span)
}

export function forestWall() {
  return {
    rings: [
      { dist: 214, count: 54, scale: 0.62 },
      { dist: 258, count: 62, scale: 0.8 }
    ],
    gap: WALL_GAP,
    pine: 0x353e27,
    shade: 0x2a331c,
    trunk: 0x4a3b2c
  }
}

export function forestWallSlots() {
  const look = forestWall()
  const slots = []
  const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
  look.rings.forEach((ring, ringIndex) => {
    for (let n = 0; n < ring.count; n++) {
      const angle = (n / ring.count) * Math.PI * 2 + ringIndex * 0.17
      if (cardinals.some((cardinal) => angleGap(angle, cardinal) < look.gap)) continue
      slots.push({
        x: Math.cos(angle) * ring.dist,
        z: Math.sin(angle) * ring.dist,
        scale: ring.scale,
        angle
      })
    }
  })
  return slots
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
