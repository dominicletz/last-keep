const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const { test } = require("node:test")
const { settledHolds } = require("./settled")

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

function javascriptFiles(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...javascriptFiles(full))
    else if (entry.name.endsWith(".js")) found.push(full)
  }
  return found
}

function functionBody(source, name) {
  const start = source.indexOf(`async function ${name}`)
  assert.notEqual(start, -1, name)
  const next = source.indexOf("\nasync function ", start + name.length)
  return source.slice(start, next === -1 ? source.length : next)
}

test("e2e does not take a single-point framebuffer probe", () => {
  const root = path.join(__dirname)
  const files = javascriptFiles(root)
  assert.ok(files.length >= 4)
  for (const file of files) {
    const source = stripComments(fs.readFileSync(file, "utf8"))
    const call = ["read", "Pixels("].join("")
    assert.equal(source.includes(call), false, file)
    assert.doesNotMatch(source, /getImageData\s*\([^)]*\b1\s*,\s*1\b/, file)
  }
})

test("visual checks go through the render helper", () => {
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  const night = functionBody(source, "twoPlayerNight")
  for (const name of ["yardGrade(", "duskGrade(", "nightGrade("]) {
    assert.ok(night.includes(name), name)
  }
  for (const banned of ["sampleObject(", "sampleWorld(", "frameGrade(", "frameMood(", "frameGround("]) {
    assert.equal(night.includes(banned), false, banned)
  }
  assert.equal(night.includes("-22, 30, -62"), false)
  assert.equal(night.includes("0, 36, 6"), false)
  const walk = functionBody(source, "movementIsInterpolated")
  assert.match(walk, /blend\(/)
  assert.doesNotMatch(walk, /age\s*<\s*45/)
  assert.doesNotMatch(walk, /step\s*>\s*0\.4/)
  assert.doesNotMatch(walk, /step\s*<\s*14/)
})

test("a goblin call is the walk sample that paints it", () => {
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  const body = functionBody(source, "phoneClear")
  assert.equal(body.includes("expect.poll(callText"), false)
  assert.match(body, /\/goblin\/i\.test\(state\.callText\)/)
  assert.match(body, /walkUntil\(/)
  const config = fs.readFileSync(path.join(__dirname, "../playwright.config.js"), "utf8")
  assert.match(config, /failOnFlakyTests:\s*!!process\.env\.CI/)
})

test("phone seats join together on the server roster", () => {
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  const body = functionBody(source, "phoneClear")
  assert.match(body, /joinTogether\(/)
  assert.match(body, /waitForSeats\(page, \["Nia", "Ada", "Lux", "Bram", "Pip"\]\)/)
  assert.doesNotMatch(body, /for \(const \[name, hero\] of/)
  assert.doesNotMatch(body, /\[data-roster\]"\)\?\.innerText/)
  assert.doesNotMatch(body, /roster\.includes\(name\)/)
  assert.doesNotMatch(body, /timeout:\s*150_000/)
  const wait = functionBody(source, "waitForSeats")
  assert.match(wait, /rosterReady\(/)
  assert.match(wait, /__lastKeep\.seats/)
  assert.doesNotMatch(wait, /\[data-roster\]/)
  assert.doesNotMatch(wait, /\btimeout\b/)
  const config = fs.readFileSync(path.join(__dirname, "../playwright.config.js"), "utf8")
  assert.match(config, /timeout:\s*150_000/)
  assert.match(config, /failOnFlakyTests:\s*!!process\.env\.CI/)
})

function seat(settled, chest, portal, chests = chest, portals = portal) {
  return { chests, portals, census: { settled, byRole: { chest, portal } } }
}

test("a quiet build waits until the painted bodies are gone", () => {
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  const body = functionBody(source, "sixSeatMatch")
  assert.match(body, /byRole\?\.shot/)
  assert.match(body, /shots === 0/)
  assert.match(body, /byRole\?\.monster/)
  assert.match(body, /bodies === 0/)
  assert.match(body, /settledHolds\(first, later\)/)
})

test("a discovered chest may raise the settled count", () => {
  const first = seat(764, 1, 1)
  const found = seat(767, 2, 3)
  assert.equal(settledHolds(first, found), true)
  assert.equal(settledHolds(first, seat(768, 2, 3)), false)
  assert.equal(settledHolds(first, { chests: 2, portals: 3, census: { settled: 767, byRole: { chest: 3, portal: 3 } } }), false)
  assert.equal(
    settledHolds(first, { chests: 0, portals: 1, census: { settled: 764, byRole: { chest: 1, portal: 1 } } }),
    false
  )
  assert.equal(settledHolds(first, seat(763, 0, 1)), true)
  assert.equal(settledHolds(first, first), true)
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  const body = functionBody(source, "sixSeatMatch")
  assert.match(body, /settledHolds\(first, later\)/)
  assert.equal(body.includes("first.census.settled)"), false)
  assert.match(source, /chests: \(game\.chests \|\| \[\]\)\.length/)
  assert.match(source, /portals: \(game\.portals \|\| \[\]\)\.length/)
})

test("scripted walks wait on the server position", () => {
  const source = stripComments(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"))
  assert.match(source, /async function walkUntil/)
  for (const name of [
    "stepEastOfTheKeep",
    "walkToRaise",
    "returnNearTheKeep",
    "steer",
    "assertFarCaptions",
    "movementIsInterpolated"
  ]) {
    const body = functionBody(source, name)
    assert.match(body, /walkUntil\(/, name)
    assert.doesNotMatch(body, /waitForTimeout/, name)
  }
})
