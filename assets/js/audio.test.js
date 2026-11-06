import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createConductor, cuesFrom, loopFiles, readAudioPrefs, writeAudioPrefs } from "./audio.js"

function memory() {
  const bag = new Map()
  return {
    getItem(key) {
      return bag.has(key) ? bag.get(key) : null
    },
    setItem(key, value) {
      bag.set(key, String(value))
    }
  }
}

const day = { tick: 1, phase: "build", keep: { hp: 900 }, events: [] }
const night = { tick: 2, phase: "wave", keep: { hp: 900 }, events: [] }

test("a night starting from the day sounds a horn and the combat loop", () => {
  assert.deepEqual(cuesFrom(day, night), ["night", "horn"])
})

test("clearing a wave sounds the sting and returns to the day loop", () => {
  const clear = { tick: 3, phase: "build", keep: { hp: 880 }, events: [] }
  assert.deepEqual(cuesFrom(night, clear), ["day", "sting"])
})

test("the keep falling sounds the fall, and a bite on the keep is not a body hit", () => {
  const bitten = {
    tick: 4,
    phase: "wave",
    keep: { hp: 896 },
    events: [{ type: "hit", x: 0, y: 0, amount: 4 }]
  }
  assert.deepEqual(cuesFrom(night, bitten), ["keep-hit"])
  const fallen = { tick: 5, phase: "over", keep: { hp: 0 }, events: [] }
  assert.deepEqual(cuesFrom(bitten, fallen), ["fall"])
})

test("a slam is a keep hit, and a monster hit, kill, and wall are their own cues", () => {
  const prev = { tick: 6, phase: "wave", keep: { hp: 900 } }
  const next = {
    tick: 7,
    phase: "wave",
    keep: { hp: 860 },
    events: [
      { type: "slam", x: 40, y: 10, amount: 40 },
      { type: "hit", x: 0, y: 0, amount: 40 },
      { type: "hit", x: 80, y: 12, amount: 9 },
      { type: "death", x: 80, y: 12 },
      { type: "place", x: 40, y: 20 }
    ]
  }
  assert.deepEqual(cuesFrom(prev, next), ["keep-hit", "hit", "kill", "build"])
})

test("mute and volume stay in storage, and the bus records cues while muted", () => {
  const storage = memory()
  writeAudioPrefs(storage, { muted: true, volume: 0.35 })
  assert.deepEqual(readAudioPrefs(storage), { muted: true, volume: 0.35 })
  const bus = createConductor({ storage })
  assert.equal(bus.prefs().muted, true)
  assert.equal(bus.prefs().volume, 0.35)
  assert.deepEqual(bus.hear(day), ["day"])
  assert.deepEqual(bus.hear(night), ["night", "horn"])
  assert.deepEqual(bus.hear(night), [])
  bus.setMuted(false)
  bus.setVolume(0.5)
  assert.equal(readAudioPrefs(storage).muted, false)
  assert.equal(readAudioPrefs(storage).volume, 0.5)
  assert.deepEqual(bus.heard(), ["day", "night", "horn"])
  for (let i = 0; i < 70; i += 1) bus.hear({ ...night, tick: 10 + i, events: [{ type: "hit", x: 40, y: 40, amount: 1 }] })
  const kept = bus.heard()
  assert.ok(kept.includes("horn"))
  assert.ok(kept.includes("day"))
  assert.ok(kept.includes("night"))
})

test("day and night beds are local files on this host", () => {
  assert.deepEqual(loopFiles, { day: "/audio/day.mp3", night: "/audio/night.mp3" })
  for (const src of Object.values(loopFiles)) {
    assert.equal(src.includes("://"), false)
    const bytes = readFileSync(new URL(`../../priv/static${src}`, import.meta.url))
    assert.ok(bytes.length > 100_000)
    assert.equal(bytes.subarray(0, 3).toString(), "ID3")
  }
})

test("the day loop plays the local file", async () => {
  const started = []
  let tones = 0
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume() {},
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime(v) {
            this.value = v
          },
          exponentialRampToValueAtTime(v) {
            this.value = v
          },
          cancelScheduledValues() {}
        },
        connect() {}
      }
    },
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        start() {
          started.push(this)
        },
        stop() {}
      }
    },
    createOscillator() {
      tones += 1
      return {
        type: "",
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {}
      }
    }
  }
  const bus = createConductor({
    storage: memory(),
    contextFactory: () => ctx,
    loadLoop: async () => ({ duration: 48 })
  })
  bus.unlock()
  assert.deepEqual(bus.hear(day), ["day"])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started.length, 1)
  assert.equal(started[0].loop, true)
  assert.equal(started[0].buffer.duration, 48)
  assert.equal(tones, 0)
  assert.equal(bus.prefs().bed, "/audio/day.mp3")
})
