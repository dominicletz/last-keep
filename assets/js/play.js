import { Socket } from "phoenix"
import { createView } from "./render"
import { loadScores } from "./landing"
import { axes, blurHiddenFocus, isTypingTarget, seatFromQuery } from "./input"
import { bonusCopy, callAnchor, edgeCalls, ignoreFocusClick, nextLine, placementReason, raiseLabel, raiseReady, reasonOpen, showReason, waveLabel } from "./hud"
import { createConductor } from "./audio"

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
    concealJoin(join)
    start(code, saved, ui)
  } else if (queried) {
    prefill(join, queried.name, queried.hero)
    concealJoin(join)
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
      revealJoin(ui.join)
      error.hidden = false
      error.textContent = body.error === "full" ? "This keep is full." : "Could not join."
      return
    }
    const stored = { token: body.token, name: seat.name.trim(), hero: seat.hero }
    localStorage.setItem("lastkeep-name", stored.name)
    localStorage.setItem(`lastkeep:${code}`, JSON.stringify(stored))
    concealJoin(ui.join)
    start(code, stored, ui)
  } catch (_err) {
    revealJoin(ui.join)
    error.hidden = false
    error.textContent = "The keep did not answer."
  }
}

function start(code, seat, ui) {
  ui.hud.hidden = false
  ui.hud.innerHTML = hudMarkup()
  ui.view.canvas.tabIndex = 0
  blurHiddenFocus(document)
  window.addEventListener("focus", () => blurHiddenFocus(document))
  const socket = new Socket("/socket")
  socket.connect()
  const channel = socket.channel(`game:${code}`, { token: seat.token, name: seat.name, hero: seat.hero })
  const input = {
    mx: 0,
    my: 0,
    ax: 0,
    ay: 0,
    attack: false,
    place: false,
    raise: false,
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
  const seen = { kinds: [], labels: [], log: [] }
  let reasonEntry = { text: "", until: 0 }
  let focused = document.hasFocus()
  const audio = createConductor({ storage: window.localStorage })
  const unlockAudio = () => audio.unlock()
  window.addEventListener("pointerdown", unlockAudio)
  window.addEventListener("keydown", unlockAudio)
  const muteButton = ui.hud.querySelector("[data-mute]")
  const volumeInput = ui.hud.querySelector("[data-volume]")
  if (volumeInput) volumeInput.value = String(Math.round(audio.prefs().volume * 100))
  if (muteButton) muteButton.textContent = audio.prefs().muted ? "Muted" : "Sound"
  muteButton?.addEventListener("click", () => {
    audio.setMuted(!audio.prefs().muted)
    muteButton.textContent = audio.prefs().muted ? "Muted" : "Sound"
    publishAudio()
  })
  volumeInput?.addEventListener("input", () => {
    audio.setVolume(Number(volumeInput.value) / 100)
    if (audio.prefs().muted) {
      audio.setMuted(false)
      if (muteButton) muteButton.textContent = "Sound"
    }
    publishAudio()
  })
  window.__lastKeepTest = {
    blur() {
      focused = false
    },
    hold(code, down) {
      if (down) keys.add(code)
      else keys.delete(code)
      send()
    },
    mute(muted) {
      audio.setMuted(muted)
      if (muteButton) muteButton.textContent = audio.prefs().muted ? "Muted" : "Sound"
      publishAudio()
    },
    volume(value) {
      audio.setVolume(value)
      if (volumeInput) volumeInput.value = String(Math.round(audio.prefs().volume * 100))
      publishAudio()
    },
    hear(snap) {
      const cues = audio.hear(snap)
      publishAudio()
      return cues
    }
  }
  window.addEventListener("blur", () => {
    focused = false
  })

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
      revealJoin(ui.join)
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
  ui.view.canvas.addEventListener("pointermove", (event) => {
    look(event)
    if (build) refresh()
  })
  ui.view.canvas.addEventListener("pointerdown", (event) => {
    const focusing = ignoreFocusClick(focused)
    focused = true
    if (event.button !== 0) return
    look(event)
    if (build) refresh()
    if (focusing && !build) return
    if (build && !aim.monster) input.place = true
    else input.attack = true
    send()
  })
  window.addEventListener("pointerup", () => {
    input.attack = false
    input.place = false
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
  window.addEventListener("keyup", (event) => {
    // Blur and other synthetic keyups are not a finger leaving the key.
    // The test hold releases through __lastKeepTest.hold, which deletes the code.
    if (!event.isTrusted) return
    keys.delete(event.code)
    send()
  })

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
    if (button.dataset.raise !== undefined && !button.disabled) {
      input.raise = true
      send()
      input.raise = false
    }
  })

  function send() {
    blurHiddenFocus(document)
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

  function publishAudio() {
    if (!window.__lastKeep) return
    const prefs = audio.prefs()
    window.__lastKeep.audio = {
      cues: audio.heard(),
      muted: prefs.muted,
      volume: prefs.volume,
      unlocked: prefs.unlocked,
      loop: prefs.loop
    }
  }

  function paint(ui, snap, selfId, armed) {
    ui.view.draw(snap, selfId)
    const me = (snap.players || []).find((player) => player.id === selfId)
    const wave = ui.hud.querySelector("[data-wave]")
    const clock = ui.hud.querySelector("[data-clock]")
    const stock = ui.hud.querySelector("[data-stock]")
    const label = waveLabel(snap.shown_wave)
    if (seen.labels[seen.labels.length - 1] !== label) seen.labels.push(label)
    ui.hud.querySelector("[data-score]").textContent = `Score ${snap.score ?? 0}`
    for (const shot of snap.projectiles || []) {
      if (!seen.kinds.includes(shot.kind)) seen.kinds.push(shot.kind)
    }
    wave.textContent = label
    clock.textContent = snap.phase === "over" ? "Fallen" : clockText(snap)
    stock.textContent = `Wood ${snap.resources.wood}  Food ${snap.resources.food}  Gold ${snap.resources.gold}`
    const heart = ui.hud.querySelector("[data-heart]")
    const hp = ui.hud.querySelector("[data-hp]")
    const names = SKILL_NAME[me?.hero] || SKILL_NAME.warrior
    if (me) {
      heart.style.width = `${Math.max(0, (me.hp / me.max) * 100)}%`
      hp.textContent = me.alive ? `${me.name}  ${me.hp} / ${me.max}` : `${me.name}  Down`
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
    const raise = ui.hud.querySelector("[data-raise]")
    if (raise) {
      raise.textContent = raiseLabel(snap.upgrade)
      raise.disabled = !raiseReady(snap.upgrade, snap.resources)
    }
    const start = ui.hud.querySelector("[data-start]")
    start.hidden = !snap.hold
    start.disabled = !me?.host
    start.textContent = me?.host ? "Start the night" : "Waiting for the host"
    if ((snap.events || []).some((ev) => ev.type === "place")) {
      build = null
      armed = null
    }
    ui.hud.querySelectorAll("[data-build]").forEach((button) => {
      const kind = button.dataset.build
      const cost = me?.costs?.[kind]
      const gold = cost?.gold ? ` ${cost.gold} gold` : ""
      const wood = cost ? `${cost.wood} wood${gold}` : ""
      button.innerHTML = `${BUILD_LABEL[kind]}<small>${wood}</small>`
      button.classList.toggle("on", kind === armed)
    })
    const cost = armed && me?.costs ? me.costs[armed] : null
    const preview = armed ? placementReason({ ...me, cost }, aim, snap.resources) : ""
    const denied = (snap.events || []).find((ev) => ev.type === "deny" && ev.reason)
    const now = performance.now()
    if (denied) reasonEntry = showReason(reasonEntry, denied.reason, now, 2200, true)
    else reasonEntry = showReason(reasonEntry, preview, now)
    const reasonNode = ui.hud.querySelector("[data-build-reason]")
    const open = reasonOpen(reasonEntry, now)
    reasonNode.hidden = !open
    reasonNode.textContent = open ? reasonEntry.text : ""
    const legal = !!me && !preview
    ui.view.ghost(armed, aim.x, aim.y, legal)
    const copy = bonusCopy(snap)
    ui.hud.querySelector("[data-forge]").textContent = copy.forge
    ui.hud.querySelector("[data-spire]").textContent = copy.spire
    ui.hud.querySelector("[data-relics]").textContent = copy.relics.length
      ? copy.relics.join(" ")
      : "A boss drops one relic."
    const roster = ui.hud.querySelector("[data-roster]")
    roster.innerHTML = (snap.players || [])
      .map((player) => {
        const width = Math.max(0, (player.hp / player.max) * 100)
        const mine = player.id === selfId ? "me" : ""
        return `<div class="who ${mine} ${player.connected ? "" : "off"}"><span>${escapeHtml(player.name)}</span><span>${escapeHtml(heroLabel(player.hero))}</span><div class="meter"><span style="width:${width}%"></span></div></div>`
      })
      .join("")
    drawHints(ui, snap)
    drawYou(ui, snap, selfId)
    drawFx(ui, snap, fx, seen)
    audio.hear(snap)
    if (window.__lastKeep) {
      window.__lastKeep.log = seen.log
      window.__lastKeep.labels = seen.labels
      window.__lastKeep.kinds = seen.kinds
      publishAudio()
    }
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
      <div class="chip"><b data-wave>Wave</b><div data-clock></div><div data-score>Score 0</div><div data-next></div><div data-build-reason hidden></div></div>
      <button type="button" data-start hidden>Start the night</button>
      <div class="chip bonuses" data-bonuses><div data-forge></div><div data-spire></div><div data-relics></div></div>
      <div class="chip" data-stock></div>
      <button type="button" data-raise>Raise the keep</button>
      <button type="button" data-copy>Copy invite</button>
      <div class="sound"><button type="button" data-mute>Sound</button><input type="range" min="0" max="100" value="70" data-volume aria-label="Volume"></div>
    </div>
    <div class="hint-layer" data-hints></div>
    <div class="hint-layer"><div data-you hidden></div></div>
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

function drawYou(ui, snap, selfId) {
  const label = ui.hud.querySelector("[data-you]")
  const me = (snap.players || []).find((player) => player.id === selfId)
  const point = me && ui.view.project ? ui.view.project(me.x, me.y) : null
  if (!label || !me || !point || point.behind) {
    if (label) label.hidden = true
    return
  }
  const rect = ui.view.canvas.getBoundingClientRect()
  const hud = ui.hud.getBoundingClientRect()
  label.hidden = false
  label.textContent = me.name
  label.style.left = `${rect.left - hud.left + (point.x * 0.5 + 0.5) * rect.width}px`
  label.style.top = `${rect.top - hud.top + (-point.y * 0.5 + 0.5) * rect.height - 28}px`
}

function drawHints(ui, snap) {
  const layer = ui.hud.querySelector("[data-hints]")
  const offscreen = edgeCalls(snap.monsters || [])
    .map((call) => marker(ui, call.x, call.y, call.label, true))
    .filter(Boolean)
  layer.innerHTML = offscreen.join("")
  const next = ui.hud.querySelector("[data-next]")
  const hints = snap.hints || []
  next.textContent = nextLine(snap.phase, hints)
  const keep = ui.hud.querySelector("[data-keep]")
  if (keep) keep.textContent = `${snap.keep.hp}/${snap.keep.max}`
}

let nextFx = 1

function drawFx(ui, snap, fx, seen) {
  const now = performance.now()
  const layer = ui.hud.querySelector("[data-fx]")
  for (const ev of snap.events || []) {
    if (ev.type !== "hit" && ev.type !== "death" && ev.type !== "boom" && ev.type !== "slam" && ev.type !== "deny") continue
    const text =
      ev.type === "death"
        ? "Slain"
        : ev.type === "boom"
          ? "Boom"
          : ev.type === "deny"
            ? ev.reason || "Can't"
            : ev.amount == null
              ? ""
              : String(ev.amount)
    if (!text || !Number.isFinite(ev.x) || !Number.isFinite(ev.y)) continue
    const id = nextFx++
    const row = {
      id,
      type: ev.type,
      amount: ev.amount || 0,
      text,
      until: now + (ev.type === "death" ? 2500 : ev.type === "hit" ? 1400 : 1100)
    }
    fx.push(row)
    seen.log.push({ type: ev.type, amount: ev.amount || 0, text })
    if (seen.log.length > 40) seen.log.shift()
    const point = ui.view.project(ev.x, ev.y)
    const node = document.createElement("div")
    node.className = `floater${ev.type === "death" ? " death" : ev.type === "deny" ? " deny" : ev.type === "boom" ? " boom" : ""}`
    node.dataset.fxId = String(id)
    node.textContent = text
    node.style.left = `${(point.x * 0.5 + 0.5) * 100}%`
    node.style.top = `${(-point.y * 0.5 + 0.5) * 100}%`
    layer.appendChild(node)
  }
  for (let i = fx.length - 1; i >= 0; i -= 1) {
    if (fx[i].until > now) continue
    layer.querySelector(`[data-fx-id="${fx[i].id}"]`)?.remove()
    fx.splice(i, 1)
  }
}

function marker(ui, worldX, worldY, label, onlyOffscreen) {
  const point = ui.view.project(worldX, worldY)
  const x = point.x * 0.5 + 0.5
  const y = -point.y * 0.5 + 0.5
  const inside = x > 0.08 && x < 0.92 && y > 0.12 && y < 0.78
  if (onlyOffscreen && inside) return ""
  const layer = ui.hud.querySelector("[data-hints]")
  const hud = ui.hud.getBoundingClientRect()
  const layerBox = layer.getBoundingClientRect()
  const anchor = callAnchor(x, y, rosterNorm(ui, hud))
  const left = anchor.left * hud.width - (layerBox.left - hud.left)
  const top = anchor.top * hud.height - (layerBox.top - hud.top)
  const end = anchor.end ? " end" : ""
  return `<div class="hint-arrow${end}" style="left:${left}px;top:${top}px">${label}</div>`
}

function rosterNorm(ui, hud) {
  const roster = ui.hud.querySelector("[data-roster]")
  if (!roster || hud.width < 1 || hud.height < 1) return null
  const box = roster.getBoundingClientRect()
  if (box.width < 8 || box.height < 8) return null
  return {
    left: (box.left - hud.left) / hud.width,
    top: (box.top - hud.top) / hud.height,
    right: (box.right - hud.left) / hud.width,
    bottom: (box.bottom - hud.top) / hud.height
  }
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

function concealJoin(join) {
  join.hidden = true
  join.inert = true
  blurHiddenFocus(document)
}

function revealJoin(join) {
  join.inert = false
  join.hidden = false
}

function typing(event) {
  if (!isTypingTarget(document.activeElement)) return false
  if (event) event.stopPropagation()
  return true
}

function heroLabel(hero) {
  const name = String(hero || "")
  if (!name) return ""
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
