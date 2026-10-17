const RELIC = {
  heartwood: "Heartwood raises the keep's health.",
  whetstone: "Whetstone adds 10% attack damage.",
  swiftness: "Swiftness makes heroes 8% faster.",
  banner: "Banner brings a downed hero back sooner.",
  granary: "Granary makes fields feed more."
}

const PLURAL = { goblin: "goblins", wolf: "wolves", troll: "trolls", boss: "bosses" }

export function waveLabel(shown) {
  const wave = Math.max(1, Number(shown) || 1)
  return `Wave ${wave}`
}

export function nextLine(phase, hints) {
  if (phase !== "build" || !hints || hints.length === 0) return ""
  const parts = hints.map((hint) => {
    const count = hint.count || 1
    const word = count === 1 ? hint.kind : PLURAL[hint.kind] || `${hint.kind}s`
    return `${count} ${word}`
  })
  return `Next: ${parts.join(", ")}`
}

export function ignoreFocusClick(wasFocused) {
  return wasFocused === false
}

export function showReason(previous, next, now, holdMs = 2200, restick = false) {
  if (!next) return { text: "", until: 0 }
  if (restick || !previous || next !== previous.text) return { text: next, until: now + holdMs }
  return previous
}

export function reasonOpen(entry, now) {
  return !!(entry && entry.text && now < entry.until)
}

export function placementReason(me, aim, resources) {
  if (!me || !aim) return ""
  const reach = me.range || 160
  if (Math.hypot(aim.x - me.x, aim.y - me.y) > reach) return "Too far"
  if (Math.hypot(aim.x, aim.y) <= 90) return "Too close to the keep"
  const wood = resources?.wood ?? 0
  const gold = resources?.gold ?? 0
  if (me.cost && wood < me.cost.wood) return "Not enough wood"
  if (me.cost && gold < me.cost.gold) return "Not enough gold"
  return ""
}

export function raiseLabel(upgrade) {
  if (!upgrade) return "The keep is as high as it goes"
  return `Raise the keep  ${upgrade.wood} wood ${upgrade.gold} gold`
}

export function raiseReady(upgrade, resources) {
  if (!upgrade) return false
  return (resources?.wood ?? 0) >= upgrade.wood && (resources?.gold ?? 0) >= upgrade.gold
}

export function edgeCalls(monsters) {
  const groups = new Map()
  for (const monster of monsters || []) {
    if (!Number.isFinite(monster?.x) || !Number.isFinite(monster?.y)) continue
    const bucket = Math.round(Math.atan2(monster.y, monster.x) / (Math.PI / 4))
    const current = groups.get(bucket) || { x: 0, y: 0, kind: monster.kind, count: 0, mixed: false }
    current.x += monster.x
    current.y += monster.y
    current.count += 1
    if (current.count > 1 && current.kind !== monster.kind) current.mixed = true
    groups.set(bucket, current)
  }
  return [...groups.values()].map((row) => {
    const kind = row.mixed ? "monster" : row.kind
    const word = row.count === 1 ? kind : row.mixed ? "monsters" : PLURAL[kind] || `${kind}s`
    return {
      x: row.x / row.count,
      y: row.y / row.count,
      label: row.count === 1 ? word : `${row.count} ${word}`
    }
  })
}

export function bonusCopy(snap) {
  return {
    forge: snap?.forge
      ? "Forge is lit. Attacks deal 15% more."
      : "Forge adds 15% damage while it stands.",
    spire: snap?.mage_tower
      ? "Spire is lit. Mages deal more and recover faster."
      : "Spire makes mages deal more and recover faster.",
    relics: (snap?.relics || []).map((name) => RELIC[name] || name)
  }
}
