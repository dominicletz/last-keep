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
    text: sackText(key, resources[key]),
    x: SACK_SPOT[key].x,
    y: SACK_SPOT[key].y
  }))
}

function sackText(key, value) {
  const count = Number(value) || 0
  const name = `${key[0].toUpperCase()}${key.slice(1)} ${count}`
  if (key === "food") return `${name}\nFeast 10`
  return name
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

const CALL_GAP = Math.PI / 3.6

export function edgeCalls(monsters) {
  const rows = []
  for (const monster of monsters || []) {
    if (!Number.isFinite(monster?.x) || !Number.isFinite(monster?.y)) continue
    rows.push({
      x: monster.x,
      y: monster.y,
      kind: monster.kind,
      angle: Math.atan2(monster.y, monster.x)
    })
  }
  rows.sort((a, b) => a.angle - b.angle)
  const groups = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.kind === row.kind && row.angle - last.end < CALL_GAP) {
      last.x += row.x
      last.y += row.y
      last.count += 1
      last.end = row.angle
    } else {
      groups.push({ x: row.x, y: row.y, kind: row.kind, count: 1, angle: row.angle, end: row.angle })
    }
  }
  if (groups.length > 1) {
    const first = groups[0]
    const last = groups[groups.length - 1]
    const wrap = first.angle + Math.PI * 2 - last.end
    if (first.kind === last.kind && wrap < CALL_GAP) {
      first.x += last.x
      first.y += last.y
      first.count += last.count
      groups.pop()
    }
  }
  return groups.map((row) => {
    const word = row.count === 1 ? row.kind : PLURAL[row.kind] || `${row.kind}s`
    return {
      x: row.x / row.count,
      y: row.y / row.count,
      label: row.count === 1 ? word : `${row.count} ${word}`
    }
  })
}

const CALL_WIDTH = 0.1
const CALL_HEIGHT = 0.05

function callHits(left, top, end, roster) {
  if (!roster || !(roster.right > roster.left) || !(roster.bottom > roster.top)) return false
  const boxLeft = end ? left - CALL_WIDTH : left
  const boxRight = end ? left : left + CALL_WIDTH
  return boxRight > roster.left && boxLeft < roster.right && top + CALL_HEIGHT > roster.top && top < roster.bottom
}

export function callAnchor(x, y, roster, bar) {
  let left = clamp(x, 0.06, 0.94)
  let top = clamp(y, 0.08, 0.78)
  let end = left > 0.5
  const barBottom = Number(bar?.bottom) || 0
  if (barBottom > 0 && top < barBottom + 0.03) top = barBottom + 0.05
  if (callHits(left, top, end, roster)) {
    const parkLeft = roster.left - 0.012
    // A left-hand roster used to shove the call to its left edge and then
    // clamp that point back onto the names. The label grew right, through them.
    if (parkLeft >= 0.04 && parkLeft - CALL_WIDTH >= 0.02) {
      left = parkLeft
      end = true
    } else {
      left = roster.right + 0.012
      end = false
    }
  }
  left = clamp(left, 0.04, 0.96)
  top = clamp(top, 0.06, 0.78)
  if (callHits(left, top, end, roster)) top = clamp(roster.bottom + 0.04, 0.06, 0.78)
  return { left, top, end }
}

export function spreadCalls(anchors) {
  const placed = []
  for (const anchor of anchors || []) {
    let top = anchor.top
    for (const other of placed) {
      if (Math.abs(other.left - anchor.left) < 0.14 && Math.abs(other.top - top) < 0.055) {
        top = Math.min(0.78, other.top + 0.07)
      }
    }
    placed.push({ ...anchor, top })
  }
  return placed
}

export function waveAnchor(hero) {
  if (!hero || !Number.isFinite(hero.x) || !Number.isFinite(hero.y)) return { x: KEEP_SIGN.x, y: KEEP_SIGN.y }
  // Screen-up is -x and -y together, so the sign clears the sacks at the hero's feet.
  return { x: hero.x - 64, y: hero.y - 64 }
}

export function visiblePin(spot, view, box, anchor = "chip", floor = 0) {
  if (!spot || !(view?.width > 0) || !(view?.height > 0)) return spot
  const width = box?.width || 0
  const height = box?.height || 0
  const corner = anchor === "corner"
  const shiftX = corner ? 0 : width / 2
  const shiftY = corner ? 0 : height * 1.2
  const tailX = corner ? width : shiftX
  const tailY = corner ? height : 0
  const minX = 8 + shiftX
  const maxX = Math.max(minX, view.width - 8 - tailX)
  const minY = Math.max(8 + shiftY, Number(floor) || 0)
  const maxY = Math.max(minY, view.height - (corner ? 8 + tailY : 72))
  return {
    left: clamp(spot.left, minX, maxX),
    top: clamp(spot.top, minY, maxY)
  }
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
