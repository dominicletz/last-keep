import { Socket } from "phoenix"
import { createView } from "./render"
import { monsterKinds, monsterParts } from "./monsters.js"
import { loadScores } from "./landing"
import { axes, blurHiddenFocus, focusedAfterBlur, inputFrame, isTypingTarget, keysAround, keysToward, seatFromQuery, shouldSend, swingFocus } from "./input"
import { combineAxes, contextAction, padSlot, stickOffset, stickVector, touchCapable, turnPrompt, viewportContent } from "./touch"
import { absorbShots, nextAttackPeak, partyPositions, swingSeen } from "./paint"
import { RELIC_SIGN, bonusCopy, buildFace, callAnchor, captionCap, clockText, consumePlace, edgeCalls, hintBeacons, ignoreFocusClick, nextLine, parkRect, pinRect, placementReason, raiseHint, raiseLabel, raiseReady, reasonOpen, rosterAnchor, sackLine, seatCaptions, seatPin, seatSacks, showReason, spreadCalls, waveAnchor, waveLabel } from "./hud"
import { createConductor } from "./audio"

const BUILD = ["wall", "tower", "trap", "field", "forge", "mage_tower"]
const PLACE_WORD = {
  wall: "Wall",
  tower: "Tower",
  trap: "Trap",
  field: "Field",
  forge: "Forge",
  mage_tower: "Spire"
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
  let stickId = null
  let stickOrigin = { x: 0, y: 0 }
  let stickDx = 0
  let stickDy = 0
  let touchAim = null
  let touchAction = null
  const pad = { attack: false, q: false, e: false, r: false, f: false, place: false, raise: false }
  const fingers = new Map()
  let selfId = null
  let latest = null
  let build = null
  let joined = false
  let aim = { x: 0, y: 0 }
  const fx = []
  const seen = { kinds: [], labels: [], log: [] }
  let reasonEntry = { text: "", until: 0 }
  let raiseHover = false
  let raiseCue = { text: "", until: 0 }
  let placeTick = null
  let focused = document.hasFocus()
  let pinned = false
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
      pinned = false
    },
    focus() {
      focused = true
      pinned = true
    },
    hold(code, down) {
      if (down) keys.add(code)
      else keys.delete(code)
      send()
    },
    aim(x, y) {
      aim = { x, y, monster: false }
    },
    toward(dx, dy) {
      return keysToward(dx, dy)
    },
    around(goalX, goalY) {
      const me = window.__lastKeep && window.__lastKeep.self
      if (!me) return []
      return keysAround(me.x, me.y, goalX, goalY)
    },
    pictures() {
      for (const kind of monsterKinds()) monsterParts(kind)
    },
    // The co-op night used to leave the mage standing on the far side of the
    // ring. The goblins killed that mage before they walked into the host's
    // camera, and Q arrived on a corpse.
    follow() {
      const game = window.__lastKeep
      const me = game && game.self
      const host = ((game && game.party) || []).find((player) => player.host)
      if (!me || !host) return
      const want = new Set(keysToward(host.x - me.x, host.y - me.y))
      for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
        if (want.has(code)) keys.add(code)
        else keys.delete(code)
      }
      send()
    },
    fight(down) {
      const game = window.__lastKeep
      const self = game && game.self
      let nearest = null
      if (down && self) {
        for (const monster of game.monsters || []) {
          const dist = Math.hypot(monster.x, monster.y)
          const threat = monster.kind === "boss" ? -2 : monster.kind === "troll" ? -1 : 0
          const score = threat * 100000 + dist
          if (!nearest || score < nearest.score) nearest = { ...monster, dist, score }
        }
      }
      const want = new Set()
      if (nearest && self) {
        aim = { x: nearest.x, y: nearest.y, monster: true }
        const reach = self.hero === "mage" || self.hero === "scout" ? 160 : 48
        const gap = Math.hypot(nearest.x - self.x, nearest.y - self.y)
        if (gap > reach) {
          // Due west has no slide, so a chase onto the keep face sits at x 73.5
          // and the night walks into the keep. The tangent is the same step as steer.
          for (const code of keysAround(self.x, self.y, nearest.x, nearest.y)) want.add(code)
        }
      }
      const hero = self && self.hero
      const pulse = down && Math.floor(performance.now() / 500) % 4 === 0
      if (pulse && hero && hero !== "farmer" && hero !== "engineer") want.add("KeyQ")
      if (pulse && hero && hero !== "engineer") want.add("KeyR")
      for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyR"]) {
        if (want.has(code)) keys.add(code)
        else keys.delete(code)
      }
      input.attack = !!nearest
      send()
    },
    home() {
      const game = window.__lastKeep
      const self = game && game.self
      const want = new Set()
      if (self && Math.hypot(self.x, self.y) >= 24) {
        for (const code of keysToward(-self.x, -self.y)) want.add(code)
      }
      for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
        if (want.has(code)) keys.add(code)
        else keys.delete(code)
      }
      send()
    },
    order(kind, x, y) {
      build = kind
      aim = { x, y, monster: false }
      input.ax = x
      input.ay = y
      input.build = kind
      input.place = true
      send()
      input.place = false
      build = null
      input.build = null
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
    },
    parade() {
      channel.push("parade", {})
    }
  }
  window.addEventListener("blur", () => {
    // A second window can fire blur while this document still has focus.
    // Clearing the flag in that gap throws away the next click. The spec's
    // focus() sticks until blur(), because the guest page can take the
    // document after that mark. A covered page with no mark still drops it.
    focused = swingFocus(focused, document.hasFocus(), pinned)
    window.setTimeout(() => {
      if (pinned || focusedAfterBlur(document.hasFocus())) focused = true
    }, 0)
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
  function finger(event) {
    return event.pointerType === "touch" || event.pointerType === "pen"
  }
  ui.view.canvas.addEventListener("pointermove", (event) => {
    if (finger(event)) return
    look(event)
    if (build) refresh()
  })
  ui.view.canvas.addEventListener("pointerdown", (event) => {
    if (finger(event)) return
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
  window.addEventListener("pointerdown", (event) => {
    if (!finger(event)) return
    if (event.target.closest && event.target.closest("button, a, input, label")) return
    if (event.clientX > window.innerWidth * 0.5) return
    stickId = event.pointerId
    stickOrigin = { x: event.clientX, y: event.clientY }
    stickDx = 0
    stickDy = 0
    const stick = ui.hud.querySelector("[data-stick]")
    const box = ui.hud.getBoundingClientRect()
    if (stick) {
      stick.hidden = false
      stick.style.left = `${event.clientX - box.left}px`
      stick.style.top = `${event.clientY - box.top}px`
    }
    const knob = ui.hud.querySelector("[data-stick-knob]")
    if (knob) knob.style.transform = "translate(0px, 0px)"
    event.preventDefault()
    event.stopPropagation()
    send()
  }, true)
  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stickId) return
    stickDx = event.clientX - stickOrigin.x
    stickDy = event.clientY - stickOrigin.y
    const knob = ui.hud.querySelector("[data-stick-knob]")
    const offset = stickOffset(stickDx, stickDy)
    if (knob) knob.style.transform = `translate(${offset.x}px, ${offset.y}px)`
    send()
  }, true)
  ui.hud.querySelector("[data-touch-pad]").addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-touch], [data-touch-context]")
    if (!button) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (button.dataset.touch) {
      pad[button.dataset.touch] = true
      fingers.set(event.pointerId, button.dataset.touch)
    } else if (touchAction?.id === "place") {
      touchAim = { x: touchAction.aim.x, y: touchAction.aim.y, monster: false }
      pad.place = true
      input.place = true
      fingers.set(event.pointerId, "place")
    } else if (touchAction?.id === "raise" && touchAction.enabled === false) {
      cueRaise()
      return
    } else if (touchAction?.id === "raise") {
      pad.raise = true
      input.raise = true
      fingers.set(event.pointerId, "raise")
    } else if (touchAction?.id === "feed") {
      const slot = padSlot("feed")
      pad[slot] = true
      fingers.set(event.pointerId, slot)
    }
    send()
  })
  window.addEventListener("pointerup", (event) => {
    releaseTouch(event)
  })
  window.addEventListener("pointercancel", (event) => {
    releaseTouch(event)
  })
  function releaseTouch(event) {
    let touched = false
    const held = fingers.get(event.pointerId)
    if (held) {
      fingers.delete(event.pointerId)
      pad[held] = false
      if (held === "attack") input.attack = false
      if (held === "place") {
        input.place = false
        touchAim = null
      }
      if (held === "raise") input.raise = false
      touched = true
    }
    if (event.pointerId === stickId) {
      stickId = null
      stickDx = 0
      stickDy = 0
      const stick = ui.hud.querySelector("[data-stick]")
      if (stick) stick.hidden = true
      touched = true
    }
    if (!finger(event)) {
      input.attack = false
      input.place = false
    }
    if (touched || !finger(event)) send()
  }

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
  const raiseHit = ui.hud.querySelector("[data-raise-hit]")
  function cueRaise() {
    const meNow = (latest?.players || []).find((player) => player.id === selfId)
    const offer = latest?.upgrade
    const text = raiseHint(meNow, offer)
    if (!text) return
    raiseCue = showReason(raiseCue, text, performance.now(), 2200, true)
    refresh()
  }
  raiseHit.addEventListener("pointerenter", () => {
    raiseHover = true
    refresh()
  })
  raiseHit.addEventListener("pointerleave", () => {
    raiseHover = false
    refresh()
  })
  raiseHit.addEventListener("pointerup", cueRaise)

  function send() {
    blurHiddenFocus(document)
    const skill =
      pad.q || pad.e || pad.r || pad.f || keys.has("KeyQ") || keys.has("KeyE") || keys.has("KeyR") || keys.has("KeyF")
    if (!shouldSend({ joined: joined && !!selfId, typing: typing(), skill })) return
    const stick = stickId === null ? { x: 0, y: 0 } : stickVector(stickDx, stickDy)
    const move = combineAxes(axes(keys), stick)
    input.mx = move.x
    input.my = move.y
    const meNow = (latest?.players || []).find((player) => player.id === selfId)
    if (meNow && (stick.x || stick.y)) aim = { x: meNow.x + stick.x * 90, y: meNow.y + stick.y * 90, monster: false }
    if (touchAim) aim = touchAim
    input.ax = aim.x
    input.ay = aim.y
    input.q = pad.q || keys.has("KeyQ")
    input.e = pad.e || keys.has("KeyE")
    input.r = pad.r || keys.has("KeyR")
    input.f = pad.f || keys.has("KeyF")
    if (pad.attack) input.attack = true
    if (pad.place) input.place = true
    if (pad.raise) input.raise = true
    input.build = build
    channel.push("input", inputFrame(input))
  }

  window.setInterval(send, 50)
  syncTouchShell()
  window.addEventListener("resize", syncTouchShell)
  window.addEventListener("touchmove", (event) => {
    if (document.documentElement.classList.contains("playing")) event.preventDefault()
  }, { passive: false })
  window.addEventListener("contextmenu", (event) => {
    if (document.documentElement.classList.contains("playing")) event.preventDefault()
  })
  window.addEventListener("selectstart", (event) => {
    if (document.documentElement.classList.contains("playing")) event.preventDefault()
  })
  function syncTouchShell() {
    const probe = {
      maxTouchPoints: navigator.maxTouchPoints || 0,
      coarse: window.matchMedia("(pointer: coarse)").matches,
      width: window.innerWidth,
      height: window.innerHeight
    }
    const on = touchCapable(probe)
    document.documentElement.classList.toggle("touch-play", on)
    document.documentElement.classList.add("playing")
    const turn = document.querySelector("#turn")
    if (turn) turn.hidden = !turnPrompt(probe)
    const padEl = ui.hud.querySelector("[data-touch-pad]")
    if (padEl) padEl.hidden = !on
    const meta = document.querySelector('meta[name="viewport"]')
    if (meta) meta.setAttribute("content", viewportContent(true))
  }

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
    seen.kinds = absorbShots(seen.kinds, snap.projectiles)
    // The first snapshot builds the test hook. Later ones only queue the
    // scene: a draw on the socket handler never yields, and the fireball
    // wait then dies when the test closes the page.
    if (window.__lastKeep) ui.view.queue(snap, selfId)
    else ui.view.draw(snap, selfId)
    const me = (snap.players || []).find((player) => player.id === selfId)
    if (window.__lastKeep) {
      window.__lastKeep.tick = snap.tick
      window.__lastKeep.projectiles = snap.projectiles || []
      window.__lastKeep.kinds = seen.kinds
      window.__lastKeep.tick = snap.tick
      window.__lastKeep.party = partyPositions(snap.players)
      const cd = me?.cds?.attack || 0
      if (me) {
        window.__lastKeep.alive = me.alive
        window.__lastKeep.hp = me.hp
        // The swing is 8 ticks. draw() is the only other writer, and an idle
        // page does not paint, so the click check never saw the cooldown.
        window.__lastKeep.attackCd = cd
        if (window.__lastKeep.self) window.__lastKeep.self.attackCd = cd
      }
      // draw() replaces this object. The peak is copied there too, or the
      // next frame would forget a swing the channel had already cooled.
      window.__lastKeep.attackPeak = nextAttackPeak(window.__lastKeep.attackPeak, cd, swingSeen(snap))
    }
    const wave = ui.hud.querySelector("[data-wave]")
    const clock = ui.hud.querySelector("[data-clock]")
    const stock = ui.hud.querySelector("[data-stock]")
    const label = waveLabel(snap.shown_wave)
    if (seen.labels[seen.labels.length - 1] !== label) seen.labels.push(label)
    ui.hud.querySelector("[data-score]").textContent = `Score ${snap.score ?? 0}`
    wave.textContent = label
    clock.textContent = snap.phase === "over" ? "Fallen" : clockText(snap)
    drawSacks(stock, snap.resources)
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
        const height = left > 0 ? `${Math.min(100, (left / max) * 100)}%` : "0%"
        node.style.height = height
        const caption = ui.hud.querySelector(`[data-skill-name="${key}"]`)
        const seconds = left > 0 ? ` ${Math.ceil(left / 1000)}s` : ""
        caption.textContent = `${names[key]}${seconds}`
        const thumbCool = ui.hud.querySelector(`[data-touch-cool="${key}"]`)
        const thumbName = ui.hud.querySelector(`[data-touch-name="${key}"]`)
        if (thumbCool) thumbCool.style.height = height
        if (thumbName) thumbName.textContent = `${names[key]}${seconds}`
      }
      const portrait = `/images/portraits/${me.hero}.png`
      ui.hud.querySelectorAll("[data-touch-portrait]").forEach((img) => {
        if (img.getAttribute("src") !== portrait) img.setAttribute("src", portrait)
      })
    }
    const raise = ui.hud.querySelector("[data-raise]")
    if (raise) {
      raise.textContent = raiseLabel(snap.upgrade)
      raise.disabled = !raiseReady(snap.upgrade, snap.resources, me)
    }
    const start = ui.hud.querySelector("[data-start]")
    start.hidden = !snap.hold
    start.disabled = !me?.host
    start.textContent = me?.host ? "Start the night" : "Waiting for the host"
    const placed = consumePlace(snap, placeTick)
    placeTick = placed.seenTick
    if (placed.clear) {
      build = null
      armed = null
    }
    ui.hud.querySelectorAll("[data-build]").forEach((button) => {
      const kind = button.dataset.build
      const cost = me?.costs?.[kind]
      const face = buildFace(kind, cost, document.documentElement.classList.contains("touch-play"))
      button.innerHTML = `${escapeHtml(face.title)}<small>${escapeHtml(face.price)}</small>`
      button.classList.toggle("on", kind === armed)
    })
    const cost = armed && me?.costs ? me.costs[armed] : null
    const now = performance.now()
    const raiseNote = raiseHover || reasonOpen(raiseCue, now) ? raiseHint(me, snap.upgrade) : ""
    const preview = armed ? placementReason({ ...me, cost }, aim, snap.resources) : raiseNote
    const denied = (snap.events || []).find((ev) => ev.type === "deny" && ev.reason)
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
    drawYou(ui, snap, selfId)
    drawWorld(ui, snap, selfId)
    seatWave(ui, snap, selfId)
    drawHints(ui, snap)
    settleCalls(ui)
    settleHeroTags(ui)
    drawFx(ui, snap, fx, seen)
    syncContext(snap, me)
    audio.hear(snap)
    if (window.__lastKeep) {
      window.__lastKeep.log = seen.log
      window.__lastKeep.labels = seen.labels
      window.__lastKeep.kinds = seen.kinds
      if (window.__lastKeep.self && me) {
        window.__lastKeep.self.alive = me.alive
        window.__lastKeep.self.hp = me.hp
      }
      publishAudio()
    }
    if (snap.phase === "over") showOver(ui, snap)
    else ui.overlay.hidden = true
  }

  function refresh() {
    if (latest) paint(ui, latest, selfId, build)
  }

  function syncContext(snap, me) {
    const button = ui.hud.querySelector("[data-touch-context]")
    if (!button) return
    touchAction = contextAction({
      hero: me ? { x: me.x, y: me.y, range: me.range } : null,
      keepR: snap.keep?.r,
      resources: snap.resources,
      upgrade: snap.upgrade,
      armed: build,
      cost: build && me?.costs ? me.costs[build] : null,
      buildings: snap.buildings
    })
    if (!touchAction) {
      button.hidden = true
      button.textContent = ""
      button.removeAttribute("aria-disabled")
      return
    }
    button.hidden = false
    button.setAttribute("aria-disabled", touchAction.enabled === false ? "true" : "false")
    button.textContent = touchAction.id === "place" ? PLACE_WORD[touchAction.kind] || "Build" : touchAction.id === "raise" ? "Raise" : "Feed"
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
        `<div class="skill" data-chrome data-skill="${key}"><b>${label}</b><small data-skill-name="${key}"></small><div class="cool"></div></div>`
    )
    .join("")
  const builds = BUILD.map((kind) => `<button type="button" class="build" data-chrome data-build="${kind}">${buildFace(kind, null, false).title}</button>`).join("")
  return `
    <div class="hud-top">
      <div class="actions">
        <button type="button" data-start hidden>Start the night</button>
        <span data-raise-hit><button type="button" data-raise>Raise the keep</button></span>
        <button type="button" data-copy>Copy invite</button>
        <div class="sound"><button type="button" data-mute>Sound</button><input type="range" min="0" max="100" value="70" data-volume aria-label="Volume"></div>
      </div>
    </div>
    <div class="hint-layer" data-hints></div>
    <div class="hint-layer">
      <div data-you hidden></div>
      <div class="chip world-pin" data-world><b data-wave>Wave</b><div data-clock></div><div data-score>Score 0</div><div data-next></div><div>Keep <span data-keep></span></div><div data-build-reason hidden></div></div>
      <div class="bonuses world-pin" data-bonuses data-world><div data-forge></div><div data-spire></div><div data-relics></div></div>
      <div class="sacks" data-stock data-world></div>
      <div class="heart world-pin" data-world><div>You <span data-hp></span></div><div class="meter"><span data-heart style="width:100%"></span></div></div>
      <div class="roster world-pin" data-roster data-world></div>
    </div>
    <div class="hint-layer" data-fx></div>
    <div class="hud-bottom">
      <div class="skills">${skills}</div>
      <div class="builds">${builds}</div>
    </div>
    ${thumbMarkup()}
  `
}

function thumbMarkup() {
  const slots = ["q", "attack", "e", "r"]
    .map((slot) => {
      return `<button type="button" class="thumb ${slot}" data-touch="${slot}"><img data-touch-portrait alt="" draggable="false" src="/images/portraits/warrior.png" /><small data-touch-name="${slot}"></small><span class="cool" data-touch-cool="${slot}"></span></button>`
    })
    .join("")
  return `<div class="thumb-pad" data-touch-pad hidden>${slots}<button type="button" class="thumb context" data-touch-context hidden></button></div><div class="stick" data-stick hidden><div class="stick-knob" data-stick-knob></div></div>`
}

function drawSacks(stock, resources) {
  if (!stock) return
  const marks = sackLine(resources)
  const html = marks.map((mark) => `<div class="sack" data-sack="${mark.key}">${escapeHtml(mark.text)}</div>`).join("")
  if (stock.dataset.drawn !== html) {
    stock.innerHTML = html
    stock.dataset.drawn = html
  }
}

function screenPoint(ui, worldX, worldY) {
  const point = ui.view.project ? ui.view.project(worldX, worldY) : null
  if (!point || point.behind || !ui.view.canvas) return null
  const rect = ui.view.canvas.getBoundingClientRect()
  const hud = ui.hud.getBoundingClientRect()
  return {
    left: rect.left - hud.left + (point.x * 0.5 + 0.5) * rect.width,
    top: rect.top - hud.top + (-point.y * 0.5 + 0.5) * rect.height
  }
}

function pin(node, spot, dy = 0) {
  if (!node) return
  if (!spot) {
    node.hidden = true
    return
  }
  node.hidden = false
  node.style.left = `${spot.left}px`
  node.style.top = `${spot.top + dy}px`
}

function drawWorld(ui, snap, selfId) {
  const stock = ui.hud.querySelector("[data-stock]")
  const marks = sackLine(snap.resources)
  const nodes = marks.map((mark) => stock?.querySelector(`[data-sack="${mark.key}"]`))
  const hudBox = ui.hud.getBoundingClientRect()
  const boxes = nodes.map((node) => ({ width: node?.offsetWidth || 0, height: node?.offsetHeight || 0 }))
  const spots = marks.map((mark) => screenPoint(ui, mark.x, mark.y)).map((spot, i) => (spot ? { key: marks[i].key, ...spot } : null))
  const keepSpot = screenPoint(ui, 0, 0)
  const keep = keepSpot
    ? { left: keepSpot.left - 42, top: keepSpot.top - 88, right: keepSpot.left + 42, bottom: keepSpot.top + 10 }
    : null
  const me = (snap.players || []).find((player) => player.id === selfId)
  pin(ui.hud.querySelector(".heart"), me ? screenPoint(ui, me.x, me.y) : null, 16)
  const controls = shownRects(ui, ".hud-top, .builds, .skills, [data-touch-pad], [data-volume], [data-raise], [data-copy], [data-mute], [data-start], .stick", 4)
  const heroBits = shownRects(ui, ".heart, [data-you]", 2)
  const seated = seatSacks(spots, { width: hudBox.width, height: hudBox.height }, boxes, keep, [...controls, ...heroBits])
  seated.forEach((spot, i) => pin(nodes[i], spot))
  const sackRects = seated.map((spot, i) => (spot ? pinRect(spot, boxes[i], "sack") : null)).filter(Boolean)
  const rosterNode = ui.hud.querySelector("[data-roster]")
  const bonusNode = ui.hud.querySelector("[data-bonuses]")
  const party = rosterAnchor(snap.players)
  const rosterSpot = screenPoint(ui, party.x, party.y)
  const belowBar = bandTop(ui, hudBox)
  const captions = seatCaptions(
    {
      spot: rosterSpot,
      box: { width: rosterNode?.offsetWidth || 0, height: rosterNode?.offsetHeight || 0 }
    },
    {
      spot: screenPoint(ui, RELIC_SIGN.x, RELIC_SIGN.y),
      box: { width: bonusNode?.offsetWidth || 0, height: bonusNode?.offsetHeight || 0 }
    },
    { width: hudBox.width, height: hudBox.height },
    controlLimit(ui, hudBox),
    belowBar,
    [...controls, ...heroBits, ...sackRects, keep].filter(Boolean)
  )
  pin(rosterNode, captions.roster)
  pin(bonusNode, captions.relic)
  const parkedControls = shownRects(
    ui,
    ".hud-top, .builds, .skills, [data-touch-pad], [data-volume], [data-raise], [data-copy], [data-mute], [data-start], .stick, .sack, .heart, [data-you]",
    4
  )
  settleNode(ui, rosterNode, [...parkedControls, ...shownRects(ui, "[data-bonuses]", 2)])
  settleNode(ui, bonusNode, [...parkedControls, ...shownRects(ui, "[data-roster]", 2)])
}

function shownRects(ui, selector, pad) {
  const hudBox = ui.hud.getBoundingClientRect()
  const rects = []
  for (const node of ui.hud.querySelectorAll(selector)) {
    if (node.hidden) continue
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden") continue
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue
    rects.push({
      left: box.left - hudBox.left - pad,
      top: box.top - hudBox.top - pad,
      right: box.right - hudBox.left + pad,
      bottom: box.bottom - hudBox.top + pad
    })
  }
  return rects
}

function settleCalls(ui) {
  const hudBox = ui.hud.getBoundingClientRect()
  const top = bandTop(ui, hudBox)
  const limit = controlLimit(ui, hudBox)
  const bounds = {
    left: 4,
    top,
    right: Math.max(4, hudBox.width - 4),
    bottom: Math.max(top + 8, limit)
  }
  const parked = []
  for (const node of ui.hud.querySelectorAll(".hint-arrow")) {
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue
    const rect = {
      left: box.left - hudBox.left,
      top: box.top - hudBox.top,
      right: box.right - hudBox.left,
      bottom: box.bottom - hudBox.top
    }
    const obstacles = [
      ...shownRects(
        ui,
        ".hud-top, .builds, .skills, [data-touch-pad], [data-touch], [data-build], [data-volume], [data-raise], [data-copy], [data-mute], [data-start], .stick, .sack, [data-bonuses], [data-roster], .heart, [data-you], .chip",
        4
      ),
      ...parked
    ]
    const next = parkRect(rect, obstacles, bounds)
    const dx = next.left - rect.left
    const dy = next.top - rect.top
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      node.style.left = `${(parseFloat(node.style.left) || 0) + dx}px`
      node.style.top = `${(parseFloat(node.style.top) || 0) + dy}px`
    }
    parked.push(next)
  }
}

const HERO_BLOCKS = ".hud-top, .builds, .skills, [data-touch-pad], [data-touch], [data-build], [data-volume], [data-raise], [data-copy], [data-mute], [data-start], .stick, .sack, [data-bonuses], [data-roster], .chip, .hint-arrow"

function settleHeroTags(ui) {
  const heart = ui.hud.querySelector(".heart")
  const name = ui.hud.querySelector("[data-you]")
  settleNode(ui, heart, shownRects(ui, HERO_BLOCKS, 4))
  settleNode(ui, name, [...shownRects(ui, HERO_BLOCKS, 4), ...shownRects(ui, ".heart", 2)])
}

function settleNode(ui, node, obstacles) {
  if (!node || node.hidden) return
  const hudBox = ui.hud.getBoundingClientRect()
  const box = node.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return
  const rect = {
    left: box.left - hudBox.left,
    top: box.top - hudBox.top,
    right: box.right - hudBox.left,
    bottom: box.bottom - hudBox.top
  }
  const next = parkRect(rect, obstacles, {
    left: 4,
    top: 4,
    right: Math.max(4, hudBox.width - 4),
    bottom: Math.max(4, hudBox.height - 4)
  })
  const dx = next.left - rect.left
  const dy = next.top - rect.top
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    node.style.left = `${(parseFloat(node.style.left) || 0) + dx}px`
    node.style.top = `${(parseFloat(node.style.top) || 0) + dy}px`
  }
}

function controlLimit(ui, hudBox) {
  let limit = hudBox.height - 8
  for (const node of ui.hud.querySelectorAll(".builds, .skills")) {
    if (node.hidden) continue
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue
    limit = Math.min(limit, box.top - hudBox.top - 8)
  }
  return limit
}

function bandTop(ui, hudBox) {
  let top = 8
  for (const node of ui.hud.querySelectorAll(".hud-top, [data-volume], [data-raise], [data-copy], [data-mute], [data-start]")) {
    if (node.hidden) continue
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden") continue
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue
    top = Math.max(top, box.bottom - hudBox.top + 6)
  }
  return top
}

function seatWave(ui, snap, selfId) {
  const sign = ui.hud.querySelector("[data-clock]")?.closest("[data-world]")
  const me = (snap.players || []).find((player) => player.id === selfId)
  const anchor = waveAnchor(me)
  const waveSpot = screenPoint(ui, anchor.x, anchor.y)
  if (!sign || !waveSpot) {
    pin(sign, null)
    return
  }
  const hudBox = ui.hud.getBoundingClientRect()
  const box = { width: sign.offsetWidth || 0, height: sign.offsetHeight || 0 }
  const floor = bandTop(ui, hudBox)
  const limit = controlLimit(ui, hudBox)
  pin(
    sign,
    seatPin(
      waveSpot,
      { width: hudBox.width, height: hudBox.height },
      box,
      obstacleRects(ui, hudBox),
      "chip",
      floor,
      captionCap("chip", box, limit)
    )
  )
}

function obstacleRects(ui, hudBox) {
  const rects = []
  for (const node of ui.hud.querySelectorAll(
    ".sack, [data-bonuses], [data-roster], .heart, [data-you], .hint-arrow, .actions, .skills, .builds, .hud-top, [data-volume], [data-raise], [data-copy], [data-mute], [data-start], [data-touch-pad], [data-touch], .stick"
  )) {
    if (node.hidden) continue
    const box = node.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) continue
    const pad = 8
    rects.push({
      left: box.left - hudBox.left - pad,
      top: box.top - hudBox.top - pad,
      right: box.right - hudBox.left + pad,
      bottom: box.bottom - hudBox.top + pad
    })
  }
  return rects
}

function drawYou(ui, snap, selfId) {
  const label = ui.hud.querySelector("[data-you]")
  const me = (snap.players || []).find((player) => player.id === selfId)
  const spot = me ? screenPoint(ui, me.x, me.y) : null
  if (!label || !spot) {
    if (label) label.hidden = true
    return
  }
  label.hidden = false
  label.textContent = me.name
  label.style.left = `${spot.left}px`
  label.style.top = `${spot.top - 28}px`
}

function drawHints(ui, snap) {
  const layer = ui.hud.querySelector("[data-hints]")
  const hud = ui.hud.getBoundingClientRect()
  const roster = rosterNorm(ui, hud)
  const bar = barNorm(ui, hud)
  const beacons =
    snap.phase === "build"
      ? hintBeacons(snap.hints).map((row) => marker(ui, row.x, row.y, row.label, false, " beacon"))
      : []
  const land = (snap.land || []).map((row) =>
    marker(ui, row.x, row.y, row.kind === "portal" ? "portal" : "chest", true, " beacon")
  )
  const pending = []
  for (const call of edgeCalls(snap.monsters || [])) {
    const projected = projectNorm(ui, call.x, call.y)
    if (!projected) continue
    const inside = projected.x > 0.08 && projected.x < 0.92 && projected.y > 0.12 && projected.y < 0.78
    if (inside) continue
    pending.push({ ...callAnchor(projected.x, projected.y, roster, bar), label: call.label })
  }
  const offscreen = spreadCalls(pending).map((anchor) => paintCall(ui, anchor, ""))
  layer.innerHTML = [...beacons, ...offscreen, ...land].filter(Boolean).join("")
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

function marker(ui, worldX, worldY, label, onlyOffscreen, extra = "") {
  const projected = projectNorm(ui, worldX, worldY)
  if (!projected) return ""
  const inside = projected.x > 0.08 && projected.x < 0.92 && projected.y > 0.12 && projected.y < 0.78
  if (onlyOffscreen && inside) return ""
  const hud = ui.hud.getBoundingClientRect()
  const anchor = callAnchor(projected.x, projected.y, rosterNorm(ui, hud), barNorm(ui, hud))
  return paintCall(ui, { ...anchor, label }, extra)
}

function projectNorm(ui, worldX, worldY) {
  const point = ui.view.project(worldX, worldY)
  if (!point) return null
  return { x: point.x * 0.5 + 0.5, y: -point.y * 0.5 + 0.5, behind: point.behind }
}

function paintCall(ui, anchor, extra = "") {
  const layer = ui.hud.querySelector("[data-hints]")
  const hud = ui.hud.getBoundingClientRect()
  const layerBox = layer.getBoundingClientRect()
  const left = anchor.left * hud.width - (layerBox.left - hud.left)
  const top = anchor.top * hud.height - (layerBox.top - hud.top)
  const end = anchor.end ? " end" : ""
  return `<div class="hint-arrow${extra}${end}" style="left:${left}px;top:${top}px">${anchor.label}</div>`
}

function barNorm(ui, hud) {
  const bar = ui.hud.querySelector(".actions")
  if (!bar || hud.height < 1) return null
  const box = bar.getBoundingClientRect()
  return { bottom: (box.bottom - hud.top) / hud.height }
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
