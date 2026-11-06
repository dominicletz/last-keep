const assert = require("node:assert/strict")
const { test } = require("node:test")
const { keysAround } = require("../assets/js/input.js")
const { axes, keysFor, settleFields, stoppedTick, walkHitsKeep, noteNorth, noteProgress, walkLoop } = require("./steer")

const BODY = 68
const SPEED = 155
const DT = 0.05

function step(x, y, goal) {
  const a = axes(keysFor({ x, y }, goal))
  const dx = a.x * SPEED * DT
  const dy = a.y * SPEED * DT
  const blocked = (px, py) => Math.hypot(px, py) < BODY
  let nx = x
  let ny = y
  if (!blocked(x + dx, y + dy)) {
    nx = x + dx
    ny = y + dy
  } else if (!blocked(x + dx, y) && Math.abs(dx) > 0.2) nx = x + dx
  else if (!blocked(x, y + dy) && Math.abs(dy) > 0.2) ny = y + dy
  return { x: nx, y: ny, moved: Math.hypot(nx - x, ny - y) }
}

function walk(start, goal) {
  let x = start.x
  let y = start.y
  let t = 0
  while (t < 45 && Math.hypot(goal.x - x, goal.y - y) > 30) {
    const next = step(x, y, goal)
    if (next.moved < 0.01) return { ok: false, x, y, t, keys: keysFor({ x, y }, goal) }
    x = next.x
    y = next.y
    t += DT
  }
  return { ok: Math.hypot(goal.x - x, goal.y - y) <= 30, t, x, y }
}

test("the keep face takes the tangent, not due west", () => {
  const keys = keysAround(73.5, 0, -400, 80)
  assert.deepEqual(keysFor({ x: 73.5, y: 0 }, { x: -400, y: 80 }), keys)
  assert.notDeepEqual(keys, ["KeyA", "KeyW"])
  assert.equal(walkHitsKeep({ x: 73.5, y: 0 }, { x: -400, y: 80 }), false)
})

test("a goal beyond the face still walks straight", () => {
  assert.deepEqual(keysAround(200, 0, -400, 0), ["KeyA", "KeyW"])
})

test("a hero on the face or the spawn reaches a chest", () => {
  const starts = [
    { x: 73.5, y: 0 },
    { x: 120, y: 0 },
    { x: -20, y: 70 },
    { x: 0, y: 80 }
  ]
  for (const start of starts) {
    for (let deg = 0; deg < 360; deg += 45) {
      const angle = (deg * Math.PI) / 180
      const goal = { x: Math.cos(angle) * 900, y: Math.sin(angle) * 900 }
      const result = walk(start, goal)
      assert.equal(result.ok, true, JSON.stringify({ start, goal, result }))
      assert.ok(result.t < 45, JSON.stringify(result))
    }
  }
})

test("a north walk that stops after gaining ground steps out", () => {
  const first = noteNorth(null, 40, 0)
  assert.equal(first.action, "hold")
  const gained = noteNorth(first.mark, -10, 500)
  assert.equal(gained.action, "hold")
  assert.ok(gained.mark.best < gained.mark.start - 40)
  const moving = noteNorth(gained.mark, -20, 1100)
  assert.equal(moving.action, "hold")
  assert.equal(moving.mark.best, -20)
  const stuck = noteNorth(moving.mark, -20, 1100 + 701)
  assert.equal(stuck.action, "step-out")
})

test("a north walk that reaches the west line is done", () => {
  const first = noteNorth(null, 20, 0)
  const there = noteNorth(first.mark, -221, 200)
  assert.equal(there.action, "arrived")
})

test("a north walk with no gain steps out after three seconds", () => {
  const first = noteNorth(null, 40, 0)
  const early = noteNorth(first.mark, 38, 2000)
  assert.equal(early.action, "hold")
  const late = noteNorth(first.mark, 38, 3001)
  assert.equal(late.action, "step-out")
})

test("a walk is stopped only when a later tick shares the position", () => {
  assert.equal(stoppedTick(null, { tick: 1, x: 432, y: 0 }), false)
  assert.equal(stoppedTick({ tick: 1, x: 432, y: 0 }, { tick: 1, x: 432, y: 0 }), false)
  assert.equal(stoppedTick({ tick: 1, x: 420, y: 0 }, { tick: 2, x: 427.8, y: 0 }), false)
  assert.equal(stoppedTick({ tick: 4, x: 432, y: 0 }, { tick: 5, x: 432, y: 0 }), true)
})

test("a stopped sample refreshes the pose and keeps the goal fields", () => {
  const settled = settleFields(
    { x: 420, y: 0, travel: 24, alive: true, held: true, cloth: true, raiseReady: true, table: { cloth: true } },
    { x: 432, y: 0, alive: true, raiseReady: false, held: true, cloth: true, table: { x: 0, y: 160, cloth: true } }
  )
  assert.equal(settled.travel, 24)
  assert.equal(settled.x, 432)
  assert.equal(settled.y, 0)
  assert.equal(settled.alive, true)
  assert.equal(settled.held, true)
  assert.equal(settled.raiseReady, false)
  assert.deepEqual(settled.table, { x: 0, y: 160, cloth: true })
})

test("a heading stays while the server position gains and turns when it stops", () => {
  const first = noteProgress(null, 10, 0)
  assert.equal(first.action, "hold")
  assert.equal(first.mark.heading, 0)
  const moving = noteProgress(first.mark, 20, 400)
  assert.equal(moving.action, "hold")
  assert.equal(moving.mark.heading, 0)
  const stalled = noteProgress(moving.mark, 21, 400 + 701)
  assert.equal(stalled.action, "turn")
  assert.equal(stalled.mark.heading, 1)
  const again = noteProgress(stalled.mark, 30, 1200)
  assert.equal(again.action, "hold")
  assert.equal(again.mark.heading, 1)
})

// A virtual link: the server ticks every 50ms and moves a held hero 148 u/s
// (the farmer). Key changes and snapshots each take `oneWay` ms to arrive.
function link(oneWay, start = 0, speed = 148) {
  const sim = { stops: [], now: 0, tick: 0, x: start, heldServer: 0, view: { tick: 0, x: start }, inbox: [], outbox: [] }
  sim.advance = (ms) => {
    const end = sim.now + ms
    while (sim.now < end) {
      sim.now += 1
      while (sim.inbox.length && sim.inbox[0].at <= sim.now) sim.heldServer = sim.inbox.shift().dir
      if (sim.now % 50 === 0) {
        sim.tick += 1
        sim.x += sim.heldServer * speed * 0.05
        sim.outbox.push({ at: sim.now + oneWay, tick: sim.tick, x: sim.x })
      }
      while (sim.outbox.length && sim.outbox[0].at <= sim.now) sim.view = sim.outbox.shift()
    }
  }
  sim.hold = (dir) => sim.inbox.push({ at: sim.now + oneWay, dir })
  // The reply to the last frame arrives a round trip after it was sent.
  sim.ack = () => sim.advance(2 * oneWay)
  return sim
}

function simWalk(sim, goal, radius, deadline, stepMs = 10, acked = true) {
  const done = (pose) => Math.abs(pose.x - goal) <= radius
  return walkLoop({
    done,
    expired: () => sim.now >= deadline,
    step: async () => {
      const diff = goal - sim.view.x
      sim.hold(Math.abs(diff) <= 12 ? 0 : Math.sign(diff))
      sim.advance(stepMs)
      return { x: sim.view.x }
    },
    pause: async () => sim.advance(80),
    tap: async () => {
      const mark = sim.view.tick
      while (sim.view.tick < mark + 2) sim.advance(5)
    },
    settle: async () => {
      sim.hold(0)
      if (acked) sim.ack()
      let previous = null
      while (sim.now < deadline) {
        const fresh = { ...sim.view }
        if (stoppedTick(previous, fresh)) {
          sim.stops.push(fresh.x)
          return { x: fresh.x }
        }
        previous = fresh
        while (sim.view.tick === fresh.tick && sim.now < deadline) sim.advance(5)
      }
      return null
    }
  })
}

test("a held walk released on the client's first inside sample coasts past an 18 radius at 300ms", async () => {
  const sim = link(150)
  while (Math.abs(300 - sim.view.x) > 18) {
    sim.hold(1)
    sim.advance(80)
  }
  sim.hold(0)
  sim.advance(1000)
  assert.ok(sim.x - 300 > 18, `stopped ${sim.x - 300} past the goal`)
})

test("the walk lands inside an 18 radius at every round trip up to 400ms", async () => {
  for (const oneWay of [0, 25, 60, 100, 150, 200]) {
    for (const goal of [120, 300, 517]) {
      const sim = link(oneWay)
      const result = await simWalk(sim, goal, 18, 20_000)
      assert.equal(result.ok, true, `oneWay ${oneWay} goal ${goal} ended at ${JSON.stringify(result.last)}`)
      assert.ok(Math.abs(sim.x - goal) <= 18, `server x ${sim.x} for goal ${goal}`)
      assert.ok(sim.now < 15_000, `oneWay ${oneWay} goal ${goal} took ${sim.now}ms`)
    }
  }
})

// The client sends a key change at once, so a hold and a release that leave
// a millisecond apart can land inside one server tick and move nothing.
test("after an overshoot each tap moves the hero, and by less than the goal is wide", async () => {
  for (const goal of [120, 300, 517]) {
    const sim = link(200, 0, 200)
    const result = await simWalk(sim, goal, 18, 20_000, 1)
    assert.equal(result.ok, true, `goal ${goal} ended at ${JSON.stringify(result.last)}`)
    assert.ok(sim.stops.length >= 2, `goal ${goal} landed without an overshoot`)
    for (let i = 1; i < sim.stops.length; i += 1) {
      const moved = Math.abs(sim.stops[i] - sim.stops[i - 1])
      assert.ok(moved > 0 && moved < 36, `goal ${goal} tap ${i} moved ${moved}`)
    }
  }
})

test("a stop read before the key-up reply can be a tap that has not started", async () => {
  const sim = link(150)
  sim.hold(1)
  sim.advance(110)
  sim.hold(0)
  const early = { ...sim.view }
  while (sim.view.tick < early.tick + 1) sim.advance(5)
  assert.equal(sim.view.x, early.x)
  sim.ack()
  sim.advance(200)
  assert.ok(sim.x > early.x, "the tap moved the hero after the early read")
  assert.ok(sim.x - early.x < 36, `a two tick tap moved ${sim.x - early.x}`)
})

test("a walk that cannot arrive returns the last pose when the deadline passes", async () => {
  const sim = link(150)
  const result = await simWalk(sim, 10_000, 18, 2_000)
  assert.equal(result.ok, false)
  assert.ok(result.last.x > 0)
})
