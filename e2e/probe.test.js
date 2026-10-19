const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const { test } = require("node:test")

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
