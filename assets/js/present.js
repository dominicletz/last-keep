export function present(snap) {
  return {
    heroes: list(snap?.players, (row) => ({
      id: row.id,
      hero: row.hero,
      x: row.x,
      y: row.y,
      facing: row.facing,
      hp: row.hp,
      max: row.max,
      cds: row.cds,
      alive: row.alive !== false,
      preview: row.preview === true,
      opacity: Number.isFinite(row.opacity) ? row.opacity : 1
    })),
    monsters: list(snap?.monsters, (row) => ({
      id: row.id,
      kind: row.kind,
      x: row.x,
      y: row.y,
      facing: Number.isFinite(row.facing) ? row.facing : Math.atan2(row.x, row.y),
      hasFacing: Number.isFinite(row.facing),
      hp: row.hp,
      max: row.max,
      attack_cd: row.attack_cd || 0,
      elite: row.elite || null
    })),
    vagrants: list(snap?.vagrants, (row) => ({
      id: row.id,
      hero: row.hero,
      x: row.x,
      y: row.y,
      facing: Number.isFinite(row.facing) ? row.facing : Math.atan2(row.x, row.y),
      hasFacing: Number.isFinite(row.facing),
      hp: row.hp,
      max: row.max,
      alive: row.alive !== false
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
