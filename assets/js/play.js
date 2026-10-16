import { Socket } from "phoenix"
import { createView } from "./render"
import { loadScores } from "./landing"

const BUILD = ["wall", "tower", "trap", "field", "forge", "mage_tower"]
const BUILD_LABEL = {
  wall: "1 Wall",
  tower: "2 Tower",
  trap: "3 Trap",
  field: "4 Field",
  forge: "5 Forge",
  mage_tower: "6 Spire"
}

export function bootPlay(code) {
  const stage = document.querySelector("#stage")
  const hud = document.querySelector("#hud")
  const join = document.querySelector("#join-game")
  const overlay = document.querySelector("#overlay")
  const view = createView(stage)
  const saved = readSeat(code)

  if (saved) {
    join.hidden = true
    start(code, saved, { stage, hud, join, overlay, view })
  } else {
    const name = join.querySelector("#player-name")
    name.value = localStorage.getItem("lastkeep-name") || ""
    join.addEventListener("submit", async (event) => {
      event.preventDefault()
      const error = join.querySelector("#join-error")
      error.hidden = true
      const hero = join.querySelector("input[name=hero]:checked").value
      const token = crypto.randomUUID().replaceAll("-", "")
      try {
        const response = await fetch(`/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name.value, hero, token })
        })
        const body = await response.json()
        if (!response.ok) {
          error.hidden = false
          error.textContent = body.error === "full" ? "This keep is full." : "Could not join."
          return
        }
        const seat = { token: body.token, name: name.value.trim(), hero }
        localStorage.setItem("lastkeep-name", seat.name)
        localStorage.setItem(`lastkeep:${code}`, JSON.stringify(seat))
        join.hidden = true
        start(code, seat, { stage, hud, join, overlay, view })
      } catch (_err) {
        error.hidden = false
        error.textContent = "The keep did not answer."
      }
    })
  }
}

function start(code, seat, ui) {
  ui.hud.hidden = false
  ui.hud.innerHTML = hudMarkup()
  const socket = new Socket("/socket")
  socket.connect()
  const channel = socket.channel(`game:${code}`, { token: seat.token, name: seat.name, hero: seat.hero })
  const input = {
    mx: 0,
    my: 0,
    ax: 0,
    ay: 0,
    attack: false,
    q: false,
    e: false,
    r: false,
    f: false,
    build: null
  }
  const keys = new Set()
  let selfId = null
  let latest = null
  let build = null
  let joined = false
  let aim = { x: 0, y: 0 }

  channel.join()
    .receive("ok", (snap) => {
      joined = true
      selfId = snap.self
      latest = snap
      paint(ui, snap, selfId, build)
    })
    .receive("error", (body) => {
      ui.join.hidden = false
      ui.hud.hidden = true
      const error = ui.join.querySelector("#join-error")
      error.hidden = false
      error.textContent = body.reason === "unknown" ? "Sit down again. This seat was lost." : "Could not enter."
      localStorage.removeItem(`lastkeep:${code}`)
    })

  channel.on("snap", (snap) => {
    selfId = snap.self || selfId
    latest = snap
    paint(ui, snap, selfId, build)
  })

  ui.view.canvas.addEventListener("pointermove", (event) => {
    const hit = ui.view.aim(event.clientX, event.clientY)
    if (hit) aim = hit
  })
  ui.view.canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0) input.attack = true
  })
  window.addEventListener("pointerup", () => {
    input.attack = false
  })

  window.addEventListener("keydown", (event) => {
    if (typing(event)) return
    keys.add(event.code)
    const buildIndex = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[event.code]
    if (buildIndex !== undefined && !event.repeat) {
      build = build === BUILD[buildIndex] ? null : BUILD[buildIndex]
      event.preventDefault()
      refresh()
    }
    if (event.code === "Escape" && !event.repeat) {
      build = null
      refresh()
    }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyR", "KeyF", "Space"].includes(event.code)) {
      event.preventDefault()
    }
  })
  window.addEventListener("keyup", (event) => keys.delete(event.code))

  ui.hud.addEventListener("click", (event) => {
    const button = event.target.closest("button")
    if (!button) return
    if (button.dataset.copy !== undefined) {
      navigator.clipboard.writeText(`${window.location.origin}/r/${code}`)
      button.textContent = "Copied"
      setTimeout(() => {
        button.textContent = "Copy invite"
      }, 1200)
    }
    if (button.dataset.build) {
      build = build === button.dataset.build ? null : button.dataset.build
      refresh()
    }
  })

  window.setInterval(() => {
    if (!joined || !selfId || typing()) return
    const move = axes(keys)
    input.mx = move.x
    input.my = move.y
    input.ax = aim.x
    input.ay = aim.y
    input.q = keys.has("KeyQ")
    input.e = keys.has("KeyE")
    input.r = keys.has("KeyR")
    input.f = keys.has("KeyF")
    input.build = build
    channel.push("input", input)
  }, 50)

  function paint(ui, snap, selfId, build) {
    ui.view.draw(snap, selfId)
    const me = (snap.players || []).find((player) => player.id === selfId)
    const wave = ui.hud.querySelector("[data-wave]")
    const clock = ui.hud.querySelector("[data-clock]")
    const stock = ui.hud.querySelector("[data-stock]")
    wave.textContent = snap.phase === "build" ? `Next wave ${snap.wave + 1}` : `Wave ${snap.wave}`
    clock.textContent = snap.phase === "over" ? "Fallen" : clockText(snap)
    stock.textContent = `Wood ${snap.resources.wood}  Food ${snap.resources.food}  Gold ${snap.resources.gold}`
    const heart = ui.hud.querySelector("[data-heart]")
    const hp = ui.hud.querySelector("[data-hp]")
    if (me) {
      heart.style.width = `${Math.max(0, (me.hp / me.max) * 100)}%`
      hp.textContent = me.alive ? `${me.hp} / ${me.max}` : "Down"
      for (const key of ["attack", "q", "e", "r"]) {
        const node = ui.hud.querySelector(`[data-skill="${key}"] .cool`)
        const left = me.cds[key]
        const max = me.cd_max[key] || 1
        node.style.height = left > 0 ? `${Math.min(100, (left / max) * 100)}%` : "0%"
      }
    }
    ui.hud.querySelectorAll("[data-build]").forEach((button) => {
      button.classList.toggle("on", button.dataset.build === build)
    })
    const roster = ui.hud.querySelector("[data-roster]")
    roster.innerHTML = (snap.players || [])
      .map((player) => {
        const width = Math.max(0, (player.hp / player.max) * 100)
        return `<div class="who ${player.connected ? "" : "off"}"><span>${escapeHtml(player.name)}</span><span>${player.hero}</span><div class="meter"><span style="width:${width}%"></span></div></div>`
      })
      .join("")
    drawHints(ui, snap)
    if (snap.phase === "over") showOver(ui, snap)
    else ui.overlay.hidden = true
  }

  function refresh() {
    if (latest) paint(ui, latest, selfId, build)
  }
}

function hudMarkup() {
  const skills = [
    ["attack", "LMB"],
    ["q", "Q"],
    ["e", "E"],
    ["r", "R"]
  ]
    .map(([key, label]) => `<div class="skill" data-skill="${key}">${label}<div class="cool"></div></div>`)
    .join("")
  const builds = BUILD.map((kind) => `<button type="button" class="build" data-build="${kind}">${BUILD_LABEL[kind]}</button>`).join("")
  return `
    <div class="hud-top">
      <div class="chip"><b data-wave>Wave</b><div data-clock></div></div>
      <div class="chip" data-stock></div>
      <button type="button" data-copy>Copy invite</button>
    </div>
    <div class="hint-layer" data-hints></div>
    <div class="hud-bottom">
      <div class="heart"><div>You <span data-hp></span></div><div class="meter"><span data-heart style="width:100%"></span></div><div>Keep <span data-keep></span></div></div>
      <div class="skills">${skills}</div>
      <div class="builds">${builds}</div>
      <div class="roster" data-roster></div>
    </div>
  `
}

function clockText(snap) {
  const seconds = Math.ceil(snap.phase_ms / 1000)
  const label = snap.phase === "build" ? "Build" : snap.enraged ? "Enraged" : "Enrage"
  return `${label} ${seconds}s`
}

function axes(keys) {
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

function drawHints(ui, snap) {
  const layer = ui.hud.querySelector("[data-hints]")
  layer.innerHTML = (snap.hints || [])
    .map((hint) => {
      const worldX = Math.cos(hint.angle) * 620
      const worldY = Math.sin(hint.angle) * 620
      const point = ui.view.project(worldX, worldY)
      const x = Math.max(0.18, Math.min(0.72, point.x * 0.5 + 0.5))
      const y = Math.max(0.18, Math.min(0.68, -point.y * 0.5 + 0.5))
      return `<div class="hint-arrow" style="left:${x * 100}%;top:${y * 100}%">${hint.kind} ${hint.count}</div>`
    })
    .join("")
  const keep = ui.hud.querySelector("[data-keep]")
  if (keep) keep.textContent = `${snap.keep.hp}/${snap.keep.max}`
}

function showOver(ui, snap) {
  if (!ui.overlay.hidden && ui.overlay.dataset.score === String(snap.score)) return
  ui.overlay.hidden = false
  ui.overlay.dataset.score = String(snap.score)
  ui.overlay.innerHTML = `
    <div class="panel">
      <h2>The keep has fallen</h2>
      <p>Wave ${snap.wave}. Survived ${snap.waves_survived}. ${snap.kills} kills. Score ${snap.score}.</p>
      <p><a class="button" href="/">New keep</a></p>
      <h2>High scores</h2>
      <ol id="score-list"></ol>
    </div>`
  loadScores()
}

function readSeat(code) {
  try {
    const raw = localStorage.getItem(`lastkeep:${code}`)
    return raw ? JSON.parse(raw) : null
  } catch (_err) {
    return null
  }
}

function typing(event) {
  const tag = document.activeElement && document.activeElement.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") {
    if (event) event.stopPropagation()
    return true
  }
  return false
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
