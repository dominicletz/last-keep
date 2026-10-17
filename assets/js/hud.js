const RELIC = {
  heartwood: "Heartwood raises the keep's health.",
  whetstone: "Whetstone adds 10% attack damage.",
  swiftness: "Swiftness makes heroes 8% faster.",
  banner: "Banner brings a downed hero back sooner.",
  granary: "Granary makes fields feed more."
}

const PLURAL = { goblin: "goblins", wolf: "wolves", troll: "trolls", bat: "bats", boss: "bosses" }

// The caption HUD locked 15 glass slots: wave, relics, stock, roster, heart,
// four skills, and six builds. The keep sign, relic lines, three sacks, the
// heart, and the roster sit in the yard. The glass keeps the four skills and
// six builds.
export const CAPTION_GLASS = 15
export const CHROME_BUDGET = 10

export const SACK_SPOT = {
  wood: { x: 52, y: 18 },
  food: { x: 72, y: 46 },
  gold: { x: 34, y: 48 }
}

export const KEEP_SIGN = { x: 110, y: -90 }
export const RELIC_SIGN = { x: -120, y: -48 }

export function chromeCount(root) {
  if (!root || typeof root.querySelectorAll !== "function") return 0
  return root.querySelectorAll("[data-chrome]").length
}

export const waveClock = /^(Frenzy in \d+s|Frenzied\. They are faster)$/

// A place event clears the armed build once per snapshot tick.
// Refreshing that same snapshot must not cancel the next arm.
export function consumePlace(snap, seenTick) {
  const placed = (snap.events || []).some((ev) => ev.type === "place")
  if (!placed || snap.tick === seenTick) return { clear: false, seenTick }
  return { clear: true, seenTick: snap.tick }
}

export function clockText(snap) {
  if (!snap || snap.hold) return "Waiting to start"
  const seconds = Math.ceil((Number(snap.phase_ms) || 0) / 1000)
  if (snap.phase === "build") return `Night in ${seconds}s`
  if (snap.enraged) return "Frenzied. They are faster"
  return `Frenzy in ${seconds}s`
}

export function waveLabel(shown) {
  const wave = Math.max(1, Number(shown) || 1)
  return `Wave ${wave}`
}

export function nextLine(phase, hints) {
  if (phase !== "build" || !hints || hints.length === 0) return ""
  const parts = hints.map((hint) => packWord(hint))
  return `Next: ${parts.join(", ")}`
}

export function sackLine(resources = {}) {
  return ["wood", "food", "gold"].map((key) => ({
    key,
    text: `${key[0].toUpperCase()}${key.slice(1)} ${Number(resources[key]) || 0}`,
    x: SACK_SPOT[key].x,
    y: SACK_SPOT[key].y
  }))
}

export function hintBeacon(hint, radius = 520) {
  const angle = Number(hint?.angle) || 0
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    label: packWord(hint)
  }
}

export function hintBeacons(hints, radius = 520) {
  return (hints || []).filter((hint) => hint && hint.kind).map((hint) => hintBeacon(hint, radius))
}

export function rosterAnchor(players) {
  const list = players || []
  if (list.length === 0) return { x: -150, y: 40 }
  const x = list.reduce((sum, player) => sum + (Number(player.x) || 0), 0) / list.length
  const y = list.reduce((sum, player) => sum + (Number(player.y) || 0), 0) / list.length
  return { x: x - 280, y: y - 50 }
}

function packWord(hint) {
  const count = hint?.count || 1
  const kind = hint?.kind || "monster"
  const word = count === 1 ? kind : PLURAL[kind] || `${kind}s`
  return `${count} ${word}`
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

export function callAnchor(x, y, roster) {
  let left = clamp(x, 0.06, 0.94)
  let top = clamp(y, 0.08, 0.88)
  if (roster && roster.right > roster.left && roster.bottom > roster.top) {
    const covers =
      left >= roster.left - 0.02 &&
      left <= roster.right + 0.02 &&
      top >= roster.top - 0.02 &&
      top <= roster.bottom + 0.02
    if (covers) left = roster.left - 0.03
  }
  return { left: clamp(left, 0.04, 0.96), top: clamp(top, 0.06, 0.9), end: left > 0.5 }
}

export function rangeRingState(armed, range) {
  const radius = Number(range) || 0
  const on = !!armed && radius > 0
  return { on, radius: on ? radius : 0 }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
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
