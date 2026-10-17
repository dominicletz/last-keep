import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const assetsDir = fileURLToPath(new URL("..", import.meta.url))
const root = path.resolve(assetsDir, "..")

function copySources(dockerfile) {
  const sources = []
  for (const line of dockerfile.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("COPY ")) continue
    const tokens = trimmed
      .split(/\s+/)
      .slice(1)
      .filter((part) => !part.startsWith("--"))
    tokens.pop()
    sources.push(...tokens)
  }
  return sources
}

function covers(sources, rel) {
  return sources.some((source) => {
    const normalized = source.replace(/\/$/, "")
    return rel === normalized || rel.startsWith(`${normalized}/`)
  })
}

function localImports(file) {
  const text = fs.readFileSync(file, "utf8")
  return [...text.matchAll(/from\s+["'](\.[^"']+)["']/g)].map((match) => match[1])
}

function resolveImport(fromFile, spec) {
  let target = path.resolve(path.dirname(fromFile), spec)
  if (!path.extname(target)) {
    if (fs.existsSync(`${target}.js`)) target += ".js"
    else if (fs.existsSync(path.join(target, "index.js"))) target = path.join(target, "index.js")
  }
  return target
}

function bundleFiles(entry) {
  const files = []
  const seen = new Set()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    files.push(file)
    for (const spec of localImports(file)) queue.push(resolveImport(file, spec))
  }
  return files
}

function missingCopies(dockerfile, entry) {
  const sources = copySources(dockerfile)
  const problems = []
  for (const file of bundleFiles(entry)) {
    if (!file.startsWith(`${root}${path.sep}`)) {
      problems.push(`${file} is outside the repo`)
      continue
    }
    const rel = path.relative(root, file).split(path.sep).join("/")
    if (!covers(sources, rel)) problems.push(`${rel} is imported by the client and is not copied into the production image`)
  }
  return problems
}

test("the production image copies every module the client bundle imports", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile.prod"), "utf8")
  const entry = path.join(assetsDir, "js/app.js")
  assert.deepEqual(missingCopies(dockerfile, entry), [])
  const withoutModels = dockerfile.replace("COPY assets/models ./assets/models\n", "")
  const missing = missingCopies(withoutModels, entry)
  assert.ok(missing.some((line) => line.includes("assets/models/registry.js")))
})
