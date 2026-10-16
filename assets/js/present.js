export function present(snap) {
  return {
    heroes: list(snap?.players, (row) => ({
      id: row.id,
      hero: row.hero,
      x: row.x,
      y: row.y,
      facing: row.facing,
      hp: row.hp,
      max: row.max
    })),
    monsters: list(snap?.monsters, (row) => ({
      id: row.id,
      kind: row.kind,
      x: row.x,
      y: row.y,
      facing: Number.isFinite(row.facing) ? row.facing : Math.atan2(row.x, row.y),
      hp: row.hp,
      max: row.max,
      elite: row.elite || null
    })),
    buildings: list(snap?.buildings, (row) => ({
      id: row.id,
      kind: row.kind,
      x: row.x,
      y: row.y,
      hp: row.hp,
      max: row.max
    }))
  }
}

function list(rows, map) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => Number.isFinite(row?.x) && Number.isFinite(row?.y)).map(map)
}
