// Day and night are local loop files. Short cues are synthesized here. No remote host.

const KEY = "last-keep-audio"
const BED_GAIN = 0.42

export const loopFiles = {
  day: "/audio/day.mp3",
  night: "/audio/night.mp3"
}

export function readAudioPrefs(storage) {
  const fallback = { muted: false, volume: 0.7 }
  if (!storage) return fallback
  try {
    const parsed = JSON.parse(storage.getItem(KEY) || "")
    return { muted: !!parsed.muted, volume: clampVolume(parsed.volume) }
  } catch (_err) {
    return fallback
  }
}

export function writeAudioPrefs(storage, prefs) {
  if (!storage) return
  storage.setItem(KEY, JSON.stringify({ muted: !!prefs.muted, volume: clampVolume(prefs.volume) }))
}

export function loopFor(snap) {
  if (!snap || snap.phase === "over") return "silent"
  if (snap.phase === "wave") return "night"
  return "day"
}

export function cuesFrom(prev, next) {
  const cues = []
  if (!next) return cues
  const loop = loopFor(next)
  if (!prev || loopFor(prev) !== loop) {
    if (loop === "day" || loop === "night") cues.push(loop)
  }
  if (prev && prev.phase !== "wave" && next.phase === "wave") cues.push("horn")
  if (prev && prev.phase === "wave" && next.phase === "build" && (next.keep?.hp ?? 0) > 0) cues.push("sting")
  if (prev && prev.phase !== "over" && next.phase === "over") cues.push("fall")
  const keepBefore = prev?.keep?.hp
  const keepAfter = next.keep?.hp
  const keepDropped = Number.isFinite(keepBefore) && Number.isFinite(keepAfter) && keepAfter < keepBefore
  const events = next.events || []
  const slammed = events.some((ev) => ev.type === "slam")
  for (const ev of events) {
    if (ev.type === "death") cues.push("kill")
    else if (ev.type === "place") cues.push("build")
    else if (ev.type === "slam") cues.push("keep-hit")
    else if (ev.type === "hit") {
      const atKeep = Math.hypot(Number(ev.x) || 0, Number(ev.y) || 0) < 16
      if (atKeep && (keepDropped || slammed)) {
        if (!slammed) cues.push("keep-hit")
      } else cues.push("hit")
    }
  }
  return cues
}

export function createConductor(options) {
  const storage = options && options.storage
  const contextFactory = options && options.contextFactory
  const loadLoop = options && options.loadLoop
  let prefs = readAudioPrefs(storage)
  let ctx = null
  let master = null
  let unlocked = false
  let prev = null
  let loop = "silent"
  let loopToken = 0
  const heard = []
  const latched = []
  const latchNames = new Set(["day", "night", "horn", "sting", "kill", "build", "fall"])
  const buffers = new Map()
  const loading = new Map()
  let beds = []

  function ensure() {
    if (ctx) return ctx
    if (contextFactory) ctx = contextFactory()
    else if (globalThis.AudioContext) ctx = new globalThis.AudioContext()
    else return null
    master = ctx.createGain()
    master.gain.value = prefs.muted ? 0 : prefs.volume
    master.connect(ctx.destination)
    return ctx
  }

  function canPlay(name) {
    return !!(ctx && unlocked && master && !prefs.muted && loopFiles[name])
  }

  function fetchLoop(name) {
    const audio = ensure()
    if (!audio || !audio.decodeAudioData || !globalThis.fetch) return Promise.reject(new Error("audio"))
    return fetch(loopFiles[name]).then((res) => {
      if (!res.ok) throw new Error(String(res.status))
      return res.arrayBuffer()
    }).then((raw) => audio.decodeAudioData(raw.slice(0)))
  }

  function bedBuffer(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name))
    if (loading.has(name)) return loading.get(name)
    const job = Promise.resolve(loadLoop ? loadLoop(name, loopFiles[name]) : fetchLoop(name))
      .then((buffer) => {
        buffers.set(name, buffer)
        loading.delete(name)
        return buffer
      })
      .catch((err) => {
        loading.delete(name)
        throw err
      })
    loading.set(name, job)
    return job
  }

  function stopLoop() {
    loopToken += 1
    const playing = beds
    beds = []
    const t = ctx && Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0
    for (const bed of playing) {
      try {
        const param = bed.gain && bed.gain.gain
        if (param && param.setValueAtTime) {
          param.cancelScheduledValues(t)
          param.setValueAtTime(Math.max(0.001, param.value || 0.001), t)
          param.exponentialRampToValueAtTime(0.001, t + 0.2)
        }
        bed.source.stop(t + 0.22)
      } catch (_err) {
        /* already stopped */
      }
    }
  }

  function startLoop(name) {
    stopLoop()
    const token = loopToken
    if (!canPlay(name) || loop !== name) return
    bedBuffer(name)
      .then((buffer) => {
        if (token !== loopToken || loop !== name || !canPlay(name)) return
        const source = ctx.createBufferSource()
        const amp = ctx.createGain()
        source.buffer = buffer
        source.loop = true
        const t = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0
        amp.gain.setValueAtTime(0.001, t)
        amp.gain.exponentialRampToValueAtTime(BED_GAIN, t + 0.35)
        source.connect(amp)
        amp.connect(master)
        source.start(t)
        beds.push({ source, gain: amp })
      })
      .catch(() => {})
  }

  function blip(freq, type, dur, gain, slide) {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    const t = ctx.currentTime
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(amp)
    amp.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  function noise(dur, gain) {
    if (!ctx || !master) return
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    const amp = ctx.createGain()
    src.buffer = buffer
    const t = ctx.currentTime
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(amp)
    amp.connect(master)
    src.start(t)
  }

  function voice(cue) {
    if (!unlocked || prefs.muted) return
    if (cue === "day" || cue === "night") startLoop(cue)
    else if (cue === "horn") blip(220, "sawtooth", 0.42, 0.12, 110)
    else if (cue === "sting") {
      blip(523, "sine", 0.28, 0.08)
      blip(659, "sine", 0.32, 0.07)
      blip(784, "sine", 0.4, 0.06)
    } else if (cue === "hit") noise(0.07, 0.1)
    else if (cue === "kill") blip(150, "square", 0.22, 0.1, 60)
    else if (cue === "build") blip(180, "sine", 0.09, 0.1)
    else if (cue === "keep-hit") blip(90, "square", 0.28, 0.14, 48)
    else if (cue === "fall") blip(196, "sawtooth", 1.1, 0.12, 42)
  }

  function applyGain() {
    if (!master) return
    master.gain.value = prefs.muted ? 0 : prefs.volume
  }

  return {
    prefs() {
      return {
        muted: prefs.muted,
        volume: prefs.volume,
        unlocked,
        loop,
        bed: loopFiles[loop] || null
      }
    },
    heard() {
      const recent = heard.filter((cue) => !latched.includes(cue))
      return latched.concat(recent)
    },
    unlock() {
      const first = !unlocked
      unlocked = true
      ensure()
      if (ctx && ctx.state === "suspended" && ctx.resume) ctx.resume()
      if (ctx) {
        for (const name of Object.keys(loopFiles)) bedBuffer(name).catch(() => {})
      }
      if (first) startLoop(loop)
    },
    setMuted(muted) {
      prefs = { muted: !!muted, volume: prefs.volume }
      writeAudioPrefs(storage, prefs)
      applyGain()
      if (prefs.muted) stopLoop()
      else startLoop(loop)
    },
    setVolume(volume) {
      prefs = { muted: prefs.muted, volume: clampVolume(volume) }
      writeAudioPrefs(storage, prefs)
      applyGain()
    },
    hear(snap) {
      if (prev && snap && prev.tick === snap.tick) return []
      const cues = cuesFrom(prev, snap)
      prev = snap
        ? { tick: snap.tick, phase: snap.phase, keep: snap.keep ? { hp: snap.keep.hp } : null }
        : null
      const nextLoop = loopFor(snap)
      const loopChanged = nextLoop !== loop
      loop = nextLoop
      if (loopChanged && loop === "silent") stopLoop()
      for (const cue of cues) {
        heard.push(cue)
        if (heard.length > 64) heard.shift()
        if (latchNames.has(cue) && !latched.includes(cue)) latched.push(cue)
        voice(cue)
      }
      return cues
    }
  }
}

function clampVolume(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0.7
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100))
}
