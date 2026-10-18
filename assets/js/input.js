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
export function keysToward(dx, dy, slack = 42) {
  if (Math.hypot(dx, dy) <= slack) return []
  const f = Math.SQRT1_2
  const dirs = [
    { keys: ["KeyW"], x: -f, y: -f },
    { keys: ["KeyW", "KeyD"], x: 0, y: -1 },
    { keys: ["KeyD"], x: f, y: -f },
    { keys: ["KeyD", "KeyS"], x: 1, y: 0 },
    { keys: ["KeyS"], x: f, y: f },
    { keys: ["KeyS", "KeyA"], x: 0, y: 1 },
    { keys: ["KeyA"], x: -f, y: f },
    { keys: ["KeyA", "KeyW"], x: -1, y: 0 }
  ]
  let best = dirs[0]
  let score = -Infinity
  for (const dir of dirs) {
    const dot = dir.x * dx + dir.y * dy
    if (dot > score) {
      score = dot
      best = dir
    }
  }
  return best.keys
}

// KeyA+KeyW is due west. On the keep face that step has no slide, so the body
// sits at x 73.5. Inside the face, walk the tangent until the goal is outward.
export function keysAround(x, y, goalX, goalY) {
  const dx = goalX - x
  const dy = goalY - y
  if (y > -165 && goalY < -160) return ["KeyW", "KeyD"]
  const keep = Math.hypot(x, y)
  if (keep < 100 && keep > 1) {
    const tx = -y / keep
    const ty = x / keep
    const outward = (x * dx + y * dy) / keep
    if (outward < 40) {
      const sign = tx * dx + ty * dy >= 0 ? 1 : -1
      return keysToward(sign * tx, sign * ty, 0)
    }
  }
  // The chest counts inside 30. The eight-way stop used to be 42, which
  // left the body short of the chest for the whole wait.
  return keysToward(dx, dy, 12)
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
