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
const SKILL_NAME = {
  warrior: { attack: "Strike", q: "Dash", e: "Guard", r: "Nova" },
  mage: { attack: "Bolt", q: "Fireball", e: "Frost", r: "Meteor" },
  scout: { attack: "Shot", q: "Dash", e: "Mark", r: "Volley" },
  farmer: { attack: "Swing", q: "Sow", e: "Harvest", r: "Feast" },
  engineer: { attack: "Mend", q: "Wall", e: "Trap", r: "Line" }
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
  const fx = []

  ui.overlay.addEventListener("click", (event) => {
    if (event.target.closest("[data-restart]")) {
      event.preventDefault()
      channel.push("restart", {})
    }
  })

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

  function look(event) {
    const hit = ui.view.aim(event.clientX, event.clientY)
    if (hit) aim = hit
  }
  ui.view.canvas.addEventListener("pointermove", look)
  ui.view.canvas.addEventListener("pointerdown", (event) => {
    look(event)
    if (event.button === 0) input.attack = true
    send()
  })
  window.addEventListener("pointerup", () => {
    input.attack = false
    send()
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
    send()
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
    if (button.dataset.start !== undefined && !button.disabled) channel.push("start", {})
  })

  function send() {
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
  }

  window.setInterval(send, 50)

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
    const names = SKILL_NAME[me?.hero] || SKILL_NAME.warrior
    if (me) {
      heart.style.width = `${Math.max(0, (me.hp / me.max) * 100)}%`
      hp.textContent = me.alive ? `${me.hp} / ${me.max}` : "Down"
      for (const key of ["attack", "q", "e", "r"]) {
        const node = ui.hud.querySelector(`[data-skill="${key}"] .cool`)
        const left = me.cds[key]
        const max = me.cd_max[key] || 1
        node.style.height = left > 0 ? `${Math.min(100, (left / max) * 100)}%` : "0%"
        const label = ui.hud.querySelector(`[data-skill-name="${key}"]`)
        const seconds = left > 0 ? ` ${Math.ceil(left / 1000)}s` : ""
        label.textContent = `${names[key]}${seconds}`
      }
    }
    const start = ui.hud.querySelector("[data-start]")
    start.hidden = !snap.hold
    start.disabled = !me?.host
    start.textContent = me?.host ? "Start the night" : "Waiting for the host"
    ui.hud.querySelectorAll("[data-build]").forEach((button) => {
      const kind = button.dataset.build
      const cost = me?.costs?.[kind]
      const gold = cost?.gold ? ` ${cost.gold} gold` : ""
      const wood = cost ? `${cost.wood} wood${gold}` : ""
      button.innerHTML = `${BUILD_LABEL[kind]}<small>${wood}</small>`
      button.classList.toggle("on", kind === build)
    })
    const legal = !!me && Math.hypot(aim.x - me.x, aim.y - me.y) <= (me.range || 160) && Math.hypot(aim.x, aim.y) > 90
    ui.view.ghost(build, aim.x, aim.y, legal)
    const roster = ui.hud.querySelector("[data-roster]")
    roster.innerHTML = (snap.players || [])
      .map((player) => {
        const width = Math.max(0, (player.hp / player.max) * 100)
        return `<div class="who ${player.connected ? "" : "off"}"><span>${escapeHtml(player.name)}</span><span>${escapeHtml(heroLabel(player.hero))}</span><div class="meter"><span style="width:${width}%"></span></div></div>`
      })
      .join("")
    drawHints(ui, snap)
    drawFx(ui, snap, fx)
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
    .map(
      ([key, label]) =>
        `<div class="skill" data-skill="${key}"><b>${label}</b><small data-skill-name="${key}"></small><div class="cool"></div></div>`
    )
    .join("")
  const builds = BUILD.map((kind) => `<button type="button" class="build" data-build="${kind}">${BUILD_LABEL[kind]}</button>`).join("")
  return `
    <div class="hud-top">
      <div class="chip"><b data-wave>Wave</b><div data-clock></div><div data-next></div></div>
      <button type="button" data-start hidden>Start the night</button>
      <div class="chip" data-stock></div>
      <button type="button" data-copy>Copy invite</button>
    </div>
    <div class="hint-layer" data-hints></div>
    <div class="hint-layer" data-fx></div>
    <div class="hud-bottom">
      <div class="heart"><div>You <span data-hp></span></div><div class="meter"><span data-heart style="width:100%"></span></div><div>Keep <span data-keep></span></div></div>
      <div class="skills">${skills}</div>
      <div class="builds">${builds}</div>
      <div class="roster" data-roster></div>
    </div>
  `
}

function clockText(snap) {
  if (snap.hold) return "Waiting to start"
  const seconds = Math.ceil(snap.phase_ms / 1000)
  if (snap.phase === "build") return `Night in ${seconds}s`
  if (snap.enraged) return "Frenzied. They are faster"
  return `Frenzy in ${seconds}s`
}

function drawHints(ui, snap) {
  const layer = ui.hud.querySelector("[data-hints]")
  const offscreen = (snap.monsters || [])
    .map((monster) => marker(ui, monster.x, monster.y, monster.kind, true))
    .filter(Boolean)
  layer.innerHTML = offscreen.join("")
  const next = ui.hud.querySelector("[data-next]")
  const hints = snap.hints || []
  next.textContent =
    snap.phase === "build" && hints.length
      ? `Next ${hints.map((hint) => `${hint.kind} ${hint.count}`).join(", ")}`
      : ""
  const keep = ui.hud.querySelector("[data-keep]")
  if (keep) keep.textContent = `${snap.keep.hp}/${snap.keep.max}`
}

function drawFx(ui, snap, fx) {
  const now = performance.now()
  for (const ev of snap.events || []) {
    if (ev.type === "hit" || ev.type === "swing" || ev.type === "shot" || ev.type === "deny") {
      fx.push({ ...ev, until: now + (ev.type === "hit" ? 700 : 280) })
    }
  }
  const live = fx.filter((item) => item.until > now)
  fx.length = 0
  fx.push(...live)
  const layer = ui.hud.querySelector("[data-fx]")
  layer.innerHTML = live
    .map((item) => {
      const point = ui.view.project(item.x, item.y)
      const left = (point.x * 0.5 + 0.5) * 100
      const top = (-point.y * 0.5 + 0.5) * 100
      if (item.type === "hit") return `<div class="floater" style="left:${left}%;top:${top}%">${item.amount || ""}</div>`
      if (item.type === "deny") return `<div class="floater deny" style="left:${left}%;top:${top}%">can't</div>`
      return `<div class="slash" style="left:${left}%;top:${top}%"></div>`
    })
    .join("")
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
      <p><button type="button" data-restart>New keep</button></p>
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

function heroLabel(hero) {
  const name = String(hero || "")
  if (!name) return ""
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
