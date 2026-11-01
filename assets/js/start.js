import { createPicture } from "./hd2d/picture"
import { createView } from "./render"
import { heroKinds, heroLine } from "./heroes.js"
import { acceptWord, classFromKey, menuEnv, stepClass } from "./start_pick.js"

const STAND = { x: 18, y: 86 }

export function mountStart({ stage, form, mode, name, hero, onAccept }) {
  const kinds = heroKinds()
  let index = Math.max(0, kinds.indexOf(hero || storedHero() || "warrior"))
  let view = null
  let tick = 1
  let alive = true
  let pads = [false, false]
  let swipe = null
  const nameInput = form.querySelector("#player-name")
  const button = form.querySelector("#start-button")
  nameInput.value = name || localStorage.getItem("lastkeep-name") || ""
  button.textContent = acceptWord(mode)
  form.hidden = false
  document.documentElement.classList.add("playing")
  show(kinds[index])

  const onKey = (event) => {
    if (form.hidden) return
    if (event.code === "Enter" && event.target !== nameInput) {
      event.preventDefault()
      form.requestSubmit()
      return
    }
    const delta = classFromKey(event.code, event.target === nameInput)
    if (!delta) return
    event.preventDefault()
    choose(delta)
  }
  const onPointerDown = (event) => {
    if (form.hidden || event.pointerType === "mouse") return
    if (event.target.closest && event.target.closest("#start-screen button, #start-screen input")) return
    swipe = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event) => {
    if (!swipe || event.pointerType === "mouse") return
    const dx = event.clientX - swipe.x
    const dy = event.clientY - swipe.y
    swipe = null
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
    choose(dx < 0 ? 1 : -1)
  }

  form.querySelector("[data-class=prev]").addEventListener("click", () => choose(-1))
  form.querySelector("[data-class=next]").addEventListener("click", () => choose(1))
  form.addEventListener("submit", (event) => {
    event.preventDefault()
    const picked = nameInput.value.trim()
    if (!picked) return
    onAccept({ name: picked, hero: kinds[index] })
  })
  window.addEventListener("keydown", onKey)
  window.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("pointerup", onPointerUp)

  const poll = () => {
    if (!alive) return
    readPads()
    requestAnimationFrame(poll)
  }
  requestAnimationFrame(poll)
  requestAnimationFrame(() => {
    if (!alive) return
    const picture = createPicture(menuEnv(deviceEnv()))
    view = createView(stage, picture)
    window.__lastKeepPicture = { ready: picture.ready, grade: () => view.grade(), tier: picture.tier }
    paint()
  })

  function choose(delta) {
    index = stepClass(index, delta, kinds.length)
    show(kinds[index])
    paint()
  }

  function show(kind) {
    form.dataset.hero = kind
    form.querySelector("[data-class-name]").textContent = title(kind)
    form.querySelector("[data-class-role]").textContent = heroLine(kind)
  }

  function paint() {
    if (!view) return
    const kind = kinds[index]
    view.draw(previewSnap(kind, tick), "pick")
    tick += 1
  }

  function readPads() {
    if (form.hidden || !navigator.getGamepads) return
    let left = false
    let right = false
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue
      left = left || !!(pad.buttons[4] && pad.buttons[4].pressed)
      right = right || !!(pad.buttons[5] && pad.buttons[5].pressed)
    }
    if (left && !pads[0]) choose(-1)
    if (right && !pads[1]) choose(1)
    pads = [left, right]
  }

  return {
    stop() {
      alive = false
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointerup", onPointerUp)
      if (view && view.stop) view.stop()
      view = null
    }
  }
}

function previewSnap(kind, tick) {
  return {
    tick,
    hd2dStill: true,
    phase: "build",
    phase_ms: 4000,
    hold: false,
    town: 0,
    wave: 0,
    keep: { hp: 900, max: 900 },
    resources: { wood: 0, gold: 0 },
    players: [
      {
        id: "pick",
        name: " ",
        hero: kind,
        x: STAND.x,
        y: STAND.y,
        facing: Math.PI,
        hp: 100,
        max: 100,
        alive: true,
        preview: true,
        host: true,
        range: 80
      }
    ],
    monsters: [],
    buildings: [],
    trees: [],
    projectiles: [],
    events: []
  }
}

function storedHero() {
  const kind = localStorage.getItem("lastkeep-hero")
  return heroKinds().includes(kind) ? kind : ""
}

function title(kind) {
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : ""
}

function deviceEnv() {
  const nav = typeof navigator === "undefined" ? {} : navigator
  const coarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches
  return {
    maxTouchPoints: nav.maxTouchPoints || 0,
    coarse: !!coarse,
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight
  }
}
