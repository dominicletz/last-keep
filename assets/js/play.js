import { Socket } from "phoenix"
import { createView } from "./render"
import { loadScores } from "./landing"
import { axes, seatFromQuery } from "./input"

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
  const ui = { stage, hud, join, overlay, view }
  const saved = readSeat(code)
  const queried = seatFromQuery(window.location.search)

  join.addEventListener("submit", (event) => {
    event.preventDefault()
    const name = join.querySelector("#player-name").value
    const hero = join.querySelector("input[name=hero]:checked").value
    const token = crypto.randomUUID().replaceAll("-", "")
    enter(code, { token, name, hero }, ui)
  })

  if (saved) {
    join.hidden = true
    start(code, saved, ui)
  } else if (queried) {
    prefill(join, queried.name, queried.hero)
    join.hidden = true
    const token = crypto.randomUUID().replaceAll("-", "")
    enter(code, { token, name: queried.name, hero: queried.hero }, ui)
  } else {
    prefill(join, localStorage.getItem("lastkeep-name") || "", "warrior")
  }
}

function prefill(join, name, hero) {
  join.querySelector("#player-name").value = name
  const radio = join.querySelector(`input[value="${hero}"]`)
  if (radio) radio.checked = true
}

async function enter(code, seat, ui) {
  const error = ui.join.querySelector("#join-error")
  error.hidden = true
  try {
    const response = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: seat.name, hero: seat.hero, token: seat.token })
    })
    const body = await response.json()
    if (!response.ok) {
      ui.join.hidden = false
      error.hidden = false
      error.textContent = body.error === "full" ? "This keep is full." : "Could not join."
      return
    }
    const stored = { token: body.token, name: seat.name.trim(), hero: seat.hero }
    localStorage.setItem("lastkeep-name", stored.name)
    localStorage.setItem(`lastkeep:${code}`, JSON.stringify(stored))
    ui.join.hidden = true
    start(code, stored, ui)
  } catch (_err) {
    ui.join.hidden = false
    error.hidden = false
    error.textContent = "The keep did not answer."
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

function drawHints(ui, snap) {
  const layer = ui.hud.querySelector("[data-hints]")
  const waveHints = (snap.hints || []).map((hint) => {
    const worldX = Math.cos(hint.angle) * 620
    const worldY = Math.sin(hint.angle) * 620
    return marker(ui, worldX, worldY, `${hint.kind} ${hint.count}`)
  })
  const offscreen = (snap.monsters || [])
    .map((monster) => marker(ui, monster.x, monster.y, monster.kind, true))
    .filter(Boolean)
  layer.innerHTML = [...waveHints, ...offscreen].join("")
  const keep = ui.hud.querySelector("[data-keep]")
  if (keep) keep.textContent = `${snap.keep.hp}/${snap.keep.max}`
}

function marker(ui, worldX, worldY, label, onlyOffscreen) {
  const point = ui.view.project(worldX, worldY)
  const x = point.x * 0.5 + 0.5
  const y = -point.y * 0.5 + 0.5
  const inside = x > 0.08 && x < 0.92 && y > 0.12 && y < 0.78
  if (onlyOffscreen && inside) return ""
  const left = Math.max(0.14, Math.min(0.86, x)) * 100
  const top = Math.max(0.16, Math.min(0.72, y)) * 100
  return `<div class="hint-arrow" style="left:${left}%;top:${top}%">${label}</div>`
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
