function keysToward(me, goal) {
  const dx = goal.x - me.x
  const dy = goal.y - me.y
  if (me.y > -165 && goal.y < -160) return ["KeyW", "KeyD"]
  if (Math.abs(dx) > 28) return dx >= 0 ? ["KeyS", "KeyD"] : ["KeyA", "KeyW"]
  if (Math.abs(dy) > 18) return dy >= 0 ? ["KeyS", "KeyA"] : ["KeyW", "KeyD"]
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["KeyS", "KeyD"] : ["KeyA", "KeyW"]
  return dy >= 0 ? ["KeyS", "KeyA"] : ["KeyW", "KeyD"]
}

const BODY = 68

function cardinalEnd(here, goal) {
  const dx = goal.x - here.x
  const dy = goal.y - here.y
  if (here.y > -165 && goal.y < -160) return { x: here.x, y: goal.y }
  if (Math.abs(dx) > 28) return { x: goal.x, y: here.y }
  if (Math.abs(dy) > 18) return { x: here.x, y: goal.y }
  if (Math.abs(dx) >= Math.abs(dy)) return { x: goal.x, y: here.y }
  return { x: here.x, y: goal.y }
}

function segmentHitsBody(ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return Math.hypot(ax, ay) < BODY
  const t = -(ax * dx + ay * dy) / len2
  if (t <= 0) return false
  const clamped = Math.min(1, t)
  return Math.hypot(ax + dx * clamped, ay + dy * clamped) < BODY
}

function walkHitsKeep(here, goal) {
  const end = cardinalEnd(here, goal)
  return segmentHitsBody(here.x, here.y, end.x, end.y)
}

function clearanceVia(here, goal) {
  const end = cardinalEnd(here, goal)
  const push = 400
  const moveX = Math.abs(end.x - here.x) >= Math.abs(end.y - here.y)
  if (moveX) {
    const sign = Math.sign(goal.y - here.y) || 1
    return { x: here.x, y: here.y + sign * push }
  }
  const sign = Math.sign(goal.x - here.x) || (here.x >= 0 ? 1 : -1)
  const viaX = here.x + sign * push
  if (Math.abs(viaX) < Math.abs(here.x)) return { x: here.x - sign * push, y: here.y }
  return { x: viaX, y: here.y }
}

module.exports = { keysToward, walkHitsKeep, clearanceVia }
