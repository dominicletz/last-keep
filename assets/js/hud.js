const RELIC = {
  heartwood: "Heartwood raises the keep's health.",
  whetstone: "Whetstone adds 10% attack damage.",
  swiftness: "Swiftness makes heroes 8% faster.",
  banner: "Banner brings a downed hero back sooner.",
  granary: "Granary makes fields feed more."
}

export function waveLabel(shown) {
  const wave = Math.max(1, Number(shown) || 1)
  return `Wave ${wave}`
}

export function ignoreFocusClick(wasFocused) {
  return wasFocused === false
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
