const HEROES = ["warrior", "mage", "scout", "farmer", "engineer"]

export function seatFromQuery(search) {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`)
  const name = (params.get("name") || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 16)
  const hero = params.get("hero")
  if (!name || !HEROES.includes(hero)) return null
  return { name, hero }
}

const NON_TEXT = new Set(["range", "radio", "checkbox", "button", "submit", "hidden", "file", "image"])

// A hidden join field can stay focused after the form closes, and after a
// window is brought forward. That focus used to swallow every movement push.
export function isTypingTarget(node) {
  if (!node || !node.tagName) return false
  const tag = node.tagName
  const text = tag === "TEXTAREA" || (tag === "INPUT" && !NON_TEXT.has(node.type))
  if (!text || node.disabled) return false
  if (typeof node.closest === "function" && node.closest("[hidden]")) return false
  return true
}

// Blurring one hidden control moves focus to the next one in the same form.
// Doing that from a focus listener chases the cursor forever and the page
// stops answering. One pass blurs the hidden control, and a re-entrant call
// does nothing.
let blurBusy = false

// A second window can blur this page and leave it focused. The swing flag
// has to follow the document, or the next click is thrown away.
export function focusedAfterBlur(documentHasFocus) {
  return !!documentHasFocus
}

// A blur event that leaves the document focused must keep the swing flag.
// Clearing it throws away the next click. An explicit blur still sticks
// when the flag was already down.
export function retainFocus(wasFocused, documentHasFocus) {
  return focusedAfterBlur(documentHasFocus) ? !!wasFocused : false
}

// The spec marks the game focused before the swing. A guest window can
// blur the host after that mark. The mark sticks until the spec blurs it.
export function swingFocus(wasFocused, documentHasFocus, pinned) {
  if (pinned) return true
  return retainFocus(wasFocused, documentHasFocus)
}

export function blurHiddenFocus(doc) {
  if (blurBusy || !doc) return false
  const active = doc.activeElement
  if (!active || typeof active.closest !== "function" || !active.closest("[hidden]")) return false
  blurBusy = true
  try {
    if (typeof active.blur === "function") active.blur()
    const next = doc.activeElement
    if (
      next &&
      next !== active &&
      typeof next.closest === "function" &&
      next.closest("[hidden]") &&
      typeof next.blur === "function"
    ) {
      next.blur()
    }
    const canvas = typeof doc.querySelector === "function" ? doc.querySelector("#stage canvas") : null
    if (canvas && typeof canvas.focus === "function") canvas.focus()
    return true
  } finally {
    blurBusy = false
  }
}

// The socket may encode a push after the next key change. The frame is the
// tap that was true at the moment of the push.
// A text field used to swallow the whole push, including a skill the test
// is holding. Movement stays put while typing. The skill still goes out.
export function shouldSend({ joined, typing, skill }) {
  return !!joined && (!typing || !!skill)
}

export function inputFrame(input) {
  return {
    mx: input.mx,
    my: input.my,
    ax: input.ax,
    ay: input.ay,
    attack: !!input.attack,
    place: !!input.place,
    raise: !!input.raise,
    q: !!input.q,
    e: !!input.e,
    r: !!input.r,
    f: !!input.f,
    build: input.build
  }
}

// Eight ways the movement keys can point. A short gap means stop: standing
// on the host is close enough, and holding a key there walks past them.
const STEP_F = Math.SQRT1_2
const DIRS = [
  { keys: ["KeyW"], x: -STEP_F, y: -STEP_F },
  { keys: ["KeyW", "KeyD"], x: 0, y: -1 },
  { keys: ["KeyD"], x: STEP_F, y: -STEP_F },
  { keys: ["KeyD", "KeyS"], x: 1, y: 0 },
  { keys: ["KeyS"], x: STEP_F, y: STEP_F },
  { keys: ["KeyS", "KeyA"], x: 0, y: 1 },
  { keys: ["KeyA"], x: -STEP_F, y: STEP_F },
  { keys: ["KeyA", "KeyW"], x: -1, y: 0 }
]

export function keysToward(dx, dy, slack = 42) {
  if (Math.hypot(dx, dy) <= slack) return []
  let best = DIRS[0]
  let score = -Infinity
  for (const dir of DIRS) {
    const dot = dir.x * dx + dir.y * dy
    if (dot > score) {
      score = dot
      best = dir
    }
  }
  return best.keys
}

// The keep disc is radius 54 and the hero is radius 14, so a center inside
// 68 is solid. Steps are one tick at each hero speed, including swiftness.
// A command counts when every one of those landings is closer to the goal.
export const KEEP_SOLID = 68
const KEEP_STEPS = [7.1, 7.4, 7.75, 10, 10.8]
const KEEP_CLEAR = KEEP_SOLID + 4

function slideTo(x, y, keys, step) {
  if (!keys || keys.length === 0) return { x, y }
  const move = axes(new Set(keys))
  const dx = move.x * step
  const dy = move.y * step
  const blocked = (px, py) => Math.hypot(px, py) < KEEP_SOLID
  if (!blocked(x + dx, y + dy)) return { x: x + dx, y: y + dy }
  if (!blocked(x + dx, y) && Math.abs(dx) > 0.2) return { x: x + dx, y }
  if (!blocked(x, y + dy) && Math.abs(dy) > 0.2) return { x, y: y + dy }
  return { x, y }
}

function keepGains(x, y, keys, goalX, goalY) {
  const before = Math.hypot(goalX - x, goalY - y)
  return KEEP_STEPS.every((step) => {
    const land = slideTo(x, y, keys, step)
    return Math.hypot(goalX - land.x, goalY - land.y) < before - 0.2
  })
}

function lineHitsKeep(x, y, goalX, goalY) {
  const dx = goalX - x
  const dy = goalY - y
  const len2 = dx * dx + dy * dy
  if (len2 < 1) return Math.hypot(x, y) < KEEP_CLEAR
  let t = -(x * dx + y * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return Math.hypot(x + t * dx, y + t * dy) < KEEP_CLEAR
}

// The goal is behind the disc. Walk the shorter tangent. A goal straight
// through the middle stays on the clockwise side, so crossing that line
// does not turn the hero around.
function keysAroundKeep(x, y, goalX, goalY) {
  const keep = Math.hypot(x, y) || 1
  const tx = -y / keep
  const ty = x / keep
  let delta = Math.atan2(goalY, goalX) - Math.atan2(y, x)
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  const rot = delta > 0.15 ? 1 : -1
  const aimX = rot * tx
  const aimY = rot * ty
  let best = null
  let score = -Infinity
  for (const dir of DIRS) {
    let moved = true
    let mx = 0
    let my = 0
    for (const step of KEEP_STEPS) {
      const land = slideTo(x, y, dir.keys, step)
      if (Math.hypot(land.x - x, land.y - y) < 0.2) moved = false
      if (step === 7.75) {
        mx = land.x - x
        my = land.y - y
      }
    }
    if (!moved) continue
    const dot = mx * aimX + my * aimY
    if (dot > score) {
      score = dot
      best = dir.keys
    }
  }
  return best || keysToward(aimX, aimY, 0)
}

function keysClearOfKeep(x, y, goalX, goalY) {
  if (!lineHitsKeep(x, y, goalX, goalY)) {
    let best = null
    let bestDist = Infinity
    for (const dir of DIRS) {
      if (!keepGains(x, y, dir.keys, goalX, goalY)) continue
      const land = slideTo(x, y, dir.keys, 7.75)
      const dist = Math.hypot(goalX - land.x, goalY - land.y)
      if (dist < bestDist) {
        bestDist = dist
        best = dir.keys
      }
    }
    if (best) return best
  }
  return keysAroundKeep(x, y, goalX, goalY)
}

// KeyA+KeyW is due west. On the keep face that step has no slide, so the body
// sits at x 73.5. Inside the face, walk the tangent until the goal is outward.
// A step whose landing is not closer, for every hero speed, is not the command.
export function keysAround(x, y, goalX, goalY) {
  const dx = goalX - x
  const dy = goalY - y
  let keys = null
  if (y > -165 && goalY < -160) keys = ["KeyW", "KeyD"]
  if (!keys) {
    const keep = Math.hypot(x, y)
    if (keep < 100 && keep > 1) {
      const tx = -y / keep
      const ty = x / keep
      const outward = (x * dx + y * dy) / keep
      if (outward < 40) {
        const sign = tx * dx + ty * dy >= 0 ? 1 : -1
        keys = keysToward(sign * tx, sign * ty, 0)
      }
    }
  }
  // The chest counts inside 30. The eight-way stop used to be 42, which
  // left the body short of the chest for the whole wait.
  if (!keys) keys = keysToward(dx, dy, 12)
  if (keys.length === 0 || keepGains(x, y, keys, goalX, goalY)) return keys
  return keysClearOfKeep(x, y, goalX, goalY)
}

export function axes(keys) {
  // The camera sits on the +x +z diagonal, so W moves toward the top of the screen.
  const f = Math.SQRT1_2
  let x = 0
  let y = 0
  if (keys.has("KeyW")) {
    x -= f
    y -= f
  }
  if (keys.has("KeyS")) {
    x += f
    y += f
  }
  if (keys.has("KeyD")) {
    x += f
    y -= f
  }
  if (keys.has("KeyA")) {
    x -= f
    y += f
  }
  const length = Math.hypot(x, y)
  if (length > 1) return { x: x / length, y: y / length }
  return { x, y }
}
