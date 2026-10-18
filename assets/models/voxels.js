// A figure is a grid of palette voxels. Greedy meshing turns that grid into
// the boxes the raster and the live scene already draw. The voxel count, not
// the merged box count, is the detail of the figure.

export const detailFloor = 12

export function detailCount(model) {
  if (Number.isInteger(model?.voxels)) return model.voxels
  return model?.parts?.length || 0
}

export function detailProblems(models, floor = detailFloor) {
  const problems = []
  for (const model of models || []) {
    const counted =
      model.family === "hero" || model.family === "monster" || model.id === "house" || model.id === "field"
    if (!counted) continue
    const count = detailCount(model)
    if (count < floor) problems.push(`${model.id} detail ${count} is below ${floor}`)
  }
  return problems
}

export function carve(size, paint) {
  const hold = size && typeof size === "object" ? Number(size.hold) || 0 : 0
  const map = new Map()
  const put = (x, y, z, name, color, mark = false) => {
    map.set(`${x},${y},${z}`, { x, y, z, name, color, mark: !!mark })
  }
  const fill = (x0, y0, z0, x1, y1, z1, name, color, mark = false) => {
    const xa = Math.min(x0, x1)
    const xb = Math.max(x0, x1)
    const ya = Math.min(y0, y1)
    const yb = Math.max(y0, y1)
    const za = Math.min(z0, z1)
    const zb = Math.max(z0, z1)
    for (let y = ya; y <= yb; y += 1) {
      for (let z = za; z <= zb; z += 1) {
        for (let x = xa; x <= xb; x += 1) put(x, y, z, name, color, mark)
      }
    }
  }
  const cut = (x, y, z) => {
    map.delete(`${x},${y},${z}`)
  }
  paint({ put, fill, cut })
  return meshVoxels([...map.values()], size, hold)
}

export function meshVoxels(cells, size, hold = 0) {
  const step = axisStep(size)
  const index = new Map(cells.map((cell) => [key(cell), cell]))
  const used = new Set()
  const boxes = []
  const ordered = [...cells].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
  for (const start of ordered) {
    if (used.has(key(start))) continue
    let w = 1
    while (open(index, used, start.x + w, start.y, start.z, start)) w += 1
    let h = 1
    while (slab(index, used, start, w, h, 0)) h += 1
    let d = 1
    while (depth(index, used, start, w, h, d)) d += 1
    for (let z = 0; z < d; z += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) used.add(key({ x: start.x + x, y: start.y + y, z: start.z + z }))
      }
    }
    boxes.push({
      name: start.name,
      mark: !!start.mark,
      shape: "box",
      color: start.color,
      w: w * step.x,
      h: h * step.y,
      d: d * step.z,
      x: (start.x + w / 2) * step.x,
      y: (start.y + h / 2) * step.y,
      z: (start.z + d / 2) * step.z,
      ...(hold > 0 ? { hold } : {})
    })
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const cell of cells) {
    minX = Math.min(minX, cell.x)
    maxX = Math.max(maxX, cell.x + 1)
    minY = Math.min(minY, cell.y)
    minZ = Math.min(minZ, cell.z)
    maxZ = Math.max(maxZ, cell.z + 1)
  }
  const cx = ((minX + maxX) / 2) * step.x
  const cz = ((minZ + maxZ) / 2) * step.z
  const foot = minY * step.y
  for (const box of boxes) {
    box.x = round(box.x - cx)
    box.y = round(box.y - foot)
    box.z = round(box.z - cz)
  }
  const keeper = new Map()
  for (const box of boxes) {
    if (!box.mark) continue
    const volume = box.w * box.h * box.d
    const prev = keeper.get(box.name)
    if (!prev || volume > prev.volume) keeper.set(box.name, { box, volume })
  }
  for (const box of boxes) {
    if (!box.mark) continue
    if (keeper.get(box.name).box !== box) box.mark = false
  }
  const markOrder = ["shoulders", "shield", "robe", "hat", "staff", "hood", "bow", "brim", "fork", "apron", "hammer"]
  boxes.sort((a, b) => rank(a, markOrder) - rank(b, markOrder) || a.y - b.y || a.x - b.x)
  return Object.assign(boxes, { voxelCount: cells.length })
}

function rank(box, markOrder) {
  if (!box.mark) return 100
  const index = markOrder.indexOf(box.name)
  return index < 0 ? 50 : index
}

function open(index, used, x, y, z, start) {
  const cell = index.get(key({ x, y, z }))
  if (!cell || used.has(key(cell))) return false
  return cell.color === start.color && cell.name === start.name && cell.mark === start.mark
}

function slab(index, used, start, w, h, z) {
  for (let x = 0; x < w; x += 1) {
    if (!open(index, used, start.x + x, start.y + h, start.z + z, start)) return false
  }
  return true
}

function depth(index, used, start, w, h, z) {
  for (let y = 0; y < h; y += 1) {
    if (!slab(index, used, { ...start, y: start.y + y }, w, 0, z)) return false
  }
  return true
}

function axisStep(size) {
  if (size && typeof size === "object") {
    const x = Number(size.x) || 1
    const y = Number(size.y) || x
    const z = Number(size.z) || x
    return { x, y, z }
  }
  const step = Number(size) || 1
  return { x: step, y: step, z: step }
}

function key(cell) {
  return `${cell.x},${cell.y},${cell.z}`
}

function round(value) {
  return Math.round(value * 1000) / 1000
}
