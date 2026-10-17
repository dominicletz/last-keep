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
