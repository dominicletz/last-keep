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

const BUILD_FACE = {
  wall: ["1", "Wall"],
  tower: ["2", "Tower"],
  trap: ["3", "Trap"],
  field: ["4", "Field"],
  forge: ["5", "Forge"],
  mage_tower: ["6", "Spire"]
}

export function buildFace(kind, cost, touch) {
  const row = BUILD_FACE[kind] || ["", "Build"]
  const title = touch ? row[1] : `${row[0]} ${row[1]}`
  if (!cost) return { title, price: "" }
  const gold = Number(cost.gold) || 0
  const price = `${Number(cost.wood) || 0} wood${gold ? ` ${gold} gold` : ""}`
  return { title, price }
}

export function sackLine(resources = {}) {
  return ["wood", "food", "gold"].map((key) => ({
    key,
    text: sackText(key, resources[key]),
    x: SACK_SPOT[key].x,
    y: SACK_SPOT[key].y
  }))
}

export function seatSacks(spots, view, boxes, keep, extra) {
  const seated = []
  const obstacles = []
  if (keep) obstacles.push(keep)
  for (const block of extra || []) if (block) obstacles.push(block)
  for (let i = 0; i < (spots || []).length; i += 1) {
    const spot = spots[i]
    const box = boxes?.[i] || { width: 0, height: 0 }
    if (!spot || !(view?.width > 0) || !(view?.height > 0)) {
      seated.push(spot)
      continue
    }
    const placed = seatPin(spot, view, box, obstacles, "sack")
    seated.push({ ...spot, left: placed.left, top: placed.top })
    obstacles.push(pinRect(placed, box, "sack"))
  }
  return seated
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

export function raiseHint(disabled, hero, upgrade) {
  if (!disabled || !upgrade) return ""
  const x = Number(hero?.x)
  const y = Number(hero?.y)
  if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) < 100) return ""
  return "Walk to the keep"
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
  return { x: hero.x - 64, y: hero.y - 64 }
}

function pinMetrics(box, anchor) {
  const width = box?.width || 0
  const height = box?.height || 0
  if (anchor === "corner") return { shiftX: 0, shiftY: 0, tailX: width, tailY: height, hang: 0 }
  if (anchor === "sack") return { shiftX: width / 2, shiftY: height, tailX: width / 2, tailY: 0, hang: 1 }
  return { shiftX: width / 2, shiftY: height * 1.2, tailX: width / 2, tailY: 0, hang: 1.2 }
}

function pinLimits(view, box, anchor, floor, cap) {
  const { shiftX, shiftY, tailX, tailY } = pinMetrics(box, anchor)
  const corner = anchor === "corner"
  const minX = 8 + shiftX
  const maxX = Math.max(minX, view.width - 8 - tailX)
  const minY = Math.max(8 + shiftY, (Number(floor) || 0) + shiftY)
  let maxY = Math.max(minY, view.height - (corner ? 8 + tailY : 72))
  if (Number.isFinite(cap)) maxY = Math.max(minY, Math.min(maxY, cap))
  return { minX, maxX, minY, maxY }
}

export function captionCap(anchor, box, limit) {
  const height = box?.height || 0
  if (anchor === "corner") return limit - height
  if (anchor === "sack") return limit
  return limit + height * 0.2
}

export function seatCaptions(roster, relic, view, limit, floor = 0, extra) {
  const rosterBox = roster?.box || { width: 0, height: 0 }
  const relicBox = relic?.box || { width: 0, height: 0 }
  const blocks = (extra || []).filter(Boolean)
  const rosterSpot = roster?.spot
    ? seatPin(roster.spot, view, rosterBox, blocks, "corner", floor, captionCap("corner", rosterBox, limit))
    : null
  const relicBlocks = rosterSpot ? [...blocks, pinRect(rosterSpot, rosterBox, "corner")] : blocks
  const relicSpot = relic?.spot
    ? seatPin(relic.spot, view, relicBox, relicBlocks, "chip", floor, captionCap("chip", relicBox, limit))
    : null
  return { roster: rosterSpot, relic: relicSpot }
}

export function seatPhoneHud({ view, sacks, boxes, keep, heart, controls, roster, relic, limit, floor }) {
  const fixed = [...(controls || []), heart].filter(Boolean)
  const seated = seatSacks(sacks, view, boxes, keep, fixed)
  const sackRects = seated.map((spot, i) => (spot ? pinRect(spot, boxes?.[i] || { width: 0, height: 0 }, "sack") : null)).filter(Boolean)
  const captions = seatCaptions(roster, relic, view, limit, floor, [...fixed, keep, ...sackRects].filter(Boolean))
  return { sacks: seated, roster: captions.roster, relic: captions.relic }
}

export function callRect(anchor, box, view) {
  const width = box?.width || 0
  const height = box?.height || 0
  const x = (Number(anchor?.left) || 0) * (view?.width || 0)
  const y = (Number(anchor?.top) || 0) * (view?.height || 0)
  if (anchor?.end) return { left: x - width, top: y, right: x, bottom: y + height }
  return { left: x, top: y, right: x + width, bottom: y + height }
}

export function parkCall(anchor, box, obstacles, view) {
  const parked = parkRect(callRect(anchor, box, view), obstacles, {
    left: 4,
    top: 4,
    right: Math.max(4, (view?.width || 0) - 4),
    bottom: Math.max(4, (view?.height || 0) - 4)
  })
  const width = view?.width || 1
  const height = view?.height || 1
  return { left: parked.left / width, top: parked.top / height, end: false, label: anchor?.label }
}

export function parkRect(rect, obstacles, bounds) {
  const width = Math.max(0, (rect?.right || 0) - (rect?.left || 0))
  const height = Math.max(0, (rect?.bottom || 0) - (rect?.top || 0))
  const minL = bounds?.left || 0
  const minT = bounds?.top || 0
  const maxL = Math.max(minL, (bounds?.right || minL) - width)
  const maxT = Math.max(minT, (bounds?.bottom || minT) - height)
  const home = {
    left: clamp(rect?.left, minL, maxL),
    top: clamp(rect?.top, minT, maxT)
  }
  home.right = home.left + width
  home.bottom = home.top + height
  const blocks = (obstacles || []).filter((block) => block && block.right > block.left && block.bottom > block.top)
  const hit = (box) => {
    let area = 0
    for (const block of blocks) {
      area += overlapArea(box, {
        left: block.left - 1,
        top: block.top - 1,
        right: block.right + 1,
        bottom: block.bottom + 1
      })
    }
    return area
  }
  if (hit(home) === 0) return home
  let best = home
  let bestArea = hit(home)
  let bestDist = Infinity
  const consider = (left, top) => {
    const x = clamp(left, minL, maxL)
    const y = clamp(top, minT, maxT)
    const box = { left: x, top: y, right: x + width, bottom: y + height }
    const area = hit(box)
    const dist = (x - home.left) ** 2 + (y - home.top) ** 2
    if (area < bestArea || (area === bestArea && dist < bestDist)) {
      best = box
      bestArea = area
      bestDist = dist
    }
    return box
  }
  // Push clear of each block, then a coarse grid. The 4px sweep runs only
  // when those two still overlap something.
  let current = home
  for (let pass = 0; pass < 8 && hit(current) > 0; pass += 1) {
    let moved = false
    for (const block of blocks) {
      if (!rectsOverlap(current, block)) continue
      const options = [
        consider(current.left, block.top - height),
        consider(current.left, block.bottom),
        consider(block.left - width, current.top),
        consider(block.right, current.top)
      ]
      for (const box of options) {
        if (hit(box) < hit(current)) {
          current = box
          moved = true
        }
      }
    }
    if (!moved) break
  }
  if (bestArea === 0) return best
  const step = 16
  const stepsX = Math.max(1, Math.ceil((maxL - minL) / step))
  const stepsY = Math.max(1, Math.ceil((maxT - minT) / step))
  for (let ix = 0; ix <= stepsX; ix += 1) {
    const left = minL + ((maxL - minL) * ix) / stepsX
    for (let iy = 0; iy <= stepsY; iy += 1) {
      const top = minT + ((maxT - minT) * iy) / stepsY
      consider(left, top)
    }
  }
  if (bestArea > 0) {
    const fine = 4
    const fineX = Math.max(1, Math.ceil((maxL - minL) / fine))
    const fineY = Math.max(1, Math.ceil((maxT - minT) / fine))
    for (let ix = 0; ix <= fineX; ix += 1) {
      const left = minL + ((maxL - minL) * ix) / fineX
      for (let iy = 0; iy <= fineY; iy += 1) {
        const top = minT + ((maxT - minT) * iy) / fineY
        consider(left, top)
      }
    }
  }
  return best
}

export function pinRect(spot, box, anchor = "chip") {
  const width = box?.width || 0
  const height = box?.height || 0
  const left = Number(spot?.left) || 0
  const top = Number(spot?.top) || 0
  const { hang } = pinMetrics(box, anchor)
  if (anchor === "corner") return { left, top, right: left + width, bottom: top + height }
  const x = left - width / 2
  const y = top - height * hang
  return { left: x, top: y, right: x + width, bottom: y + height }
}

export function rectsOverlap(a, b) {
  if (!a || !b) return false
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function overlapArea(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  if (width <= 0 || height <= 0) return 0
  return width * height
}

export function visiblePin(spot, view, box, anchor = "chip", floor = 0, cap = Infinity) {
  if (!spot || !(view?.width > 0) || !(view?.height > 0)) return spot
  const { minX, maxX, minY, maxY } = pinLimits(view, box, anchor, floor, cap)
  return {
    left: clamp(spot.left, minX, maxX),
    top: clamp(spot.top, minY, maxY)
  }
}

function visualBounds(view, box, anchor, floor, cap) {
  const { minX, maxX, minY, maxY } = pinLimits(view, box, anchor, floor, cap)
  const { shiftX, shiftY } = pinMetrics(box, anchor)
  const width = box?.width || 0
  const height = box?.height || 0
  return {
    left: minX - shiftX,
    top: minY - shiftY,
    right: maxX - shiftX + width,
    bottom: maxY - shiftY + height
  }
}

function spotFromRect(rect, box, anchor) {
  const { shiftX, shiftY } = pinMetrics(box, anchor)
  return { left: rect.left + shiftX, top: rect.top + shiftY }
}

export function seatPin(spot, view, box, obstacles, anchor = "chip", floor = 0, cap = Infinity) {
  const home = visiblePin(spot, view, box, anchor, floor, cap)
  if (!home || !(view?.width > 0) || !(view?.height > 0)) return home
  const parked = parkRect(pinRect(home, box, anchor), obstacles, visualBounds(view, box, anchor, floor, cap))
  return spotFromRect(parked, box, anchor)
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
