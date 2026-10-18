export const STICK_RADIUS = 64

const DEAD = 0.18
const HERO_R = 14
const KEEP_CLEAR = 28
const RAISE_PAD = 36
const FEED_REACH = 100
const FOOT = { wall: 16, tower: 16, trap: 15, field: 16, forge: 18, mage_tower: 18 }

export function snapGrid(value) {
  const stepped = value / 36
  const rounded = stepped < 0 ? -Math.round(Math.abs(stepped)) : Math.round(stepped)
  return rounded * 36
}

export function stickOffset(dx, dy, radius = STICK_RADIUS) {
  const mag = Math.hypot(dx, dy)
  if (mag === 0 || mag <= radius) return { x: dx, y: dy }
  const scale = radius / mag
  return { x: dx * scale, y: dy * scale }
}

export function stickVector(dx, dy, radius = STICK_RADIUS) {
  const reach = radius > 0 ? radius : STICK_RADIUS
  const offset = stickOffset(dx, dy, reach)
  const mag = Math.hypot(offset.x, offset.y) / reach
  if (mag <= DEAD) return { x: 0, y: 0 }
  const scaled = Math.min(1, (mag - DEAD) / (1 - DEAD))
  const sx = (offset.x / reach / mag) * scaled
  const sy = (offset.y / reach / mag) * scaled
  const f = Math.SQRT1_2
  const x = f * (sx + sy)
  const y = f * (sy - sx)
  const length = Math.hypot(x, y)
  if (length > 1) return { x: x / length, y: y / length }
  return { x, y }
}

export function combineAxes(keys, stick) {
  const x = (keys?.x || 0) + (stick?.x || 0)
  const y = (keys?.y || 0) + (stick?.y || 0)
  const length = Math.hypot(x, y)
  if (length > 1) return { x: x / length, y: y / length }
  return { x, y }
}

export function touchCapable(probe) {
  if (!probe || typeof probe !== "object") return false
  if (Number(probe.maxTouchPoints) > 0) return true
  return probe.coarse === true
}

export function turnPrompt(probe) {
  if (!probe) return false
  return touchCapable(probe) && Number(probe.height) > Number(probe.width)
}

export function viewportContent(playing) {
  if (playing) return "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
  return "width=device-width, initial-scale=1, viewport-fit=cover"
}

export function contextAction(scene) {
  if (!scene?.hero || !Number.isFinite(scene.hero.x) || !Number.isFinite(scene.hero.y)) return null
  if (scene.armed) {
    const spot = legalPlot(scene)
    if (spot && canPay(scene.resources, scene.cost)) return { id: "place", kind: scene.armed, aim: spot }
  }
  if (canRaise(scene)) return { id: "raise" }
  if (canFeed(scene)) return { id: "feed" }
  return null
}

function canPay(resources, cost) {
  if (!cost) return true
  return (resources?.wood ?? 0) >= (cost.wood || 0) && (resources?.gold ?? 0) >= (cost.gold || 0)
}

function canRaise(scene) {
  const keepR = scene.keepR ?? 54
  const near = Math.hypot(scene.hero.x, scene.hero.y) <= keepR + HERO_R + RAISE_PAD
  const offer = scene.upgrade
  if (!near || !offer) return false
  return (scene.resources?.wood ?? 0) >= offer.wood && (scene.resources?.gold ?? 0) >= offer.gold
}

function canFeed(scene) {
  return Math.hypot(scene.hero.x, scene.hero.y) < FEED_REACH && (scene.resources?.food ?? 0) >= 5
}

function legalPlot(scene) {
  const hero = scene.hero
  const reach = hero.range || 160
  const keepLimit = (scene.keepR ?? 54) + KEEP_CLEAR
  const foot = FOOT[scene.armed] || 16
  const dist = Math.hypot(hero.x, hero.y) || 1
  const base = Math.atan2(hero.y / dist, hero.x / dist)
  const steps = [72, 108, 144, 36]
  const turns = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]
  for (const step of steps) {
    for (const turn of turns) {
      const ang = base + turn
      const x = snapGrid(hero.x + Math.cos(ang) * step)
      const y = snapGrid(hero.y + Math.sin(ang) * step)
      if (Math.hypot(x - hero.x, y - hero.y) > reach) continue
      if (Math.hypot(x, y) < keepLimit) continue
      if (overlaps(x, y, foot, scene.buildings)) continue
      return { x, y }
    }
  }
  return null
}

function overlaps(x, y, foot, buildings) {
  return (buildings || []).some((building) => {
    const gap = (building.r || 16) + foot - 6
    return Math.hypot((building.x || 0) - x, (building.y || 0) - y) < gap
  })
}
