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

test("the deploy recreates caddy after the app and asks /health again before the smoke", () => {
  const remote = fs.readFileSync(path.join(root, "deploy/remote.sh"), "utf8")
  const compose = fs.readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8")
  const caddy = fs.readFileSync(path.join(root, "Caddyfile"), "utf8")
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/deploy.yml"), "utf8")
  const ready = fs.readFileSync(path.join(root, "deploy/ready.sh"), "utf8")
  const appUp = remote.indexOf("up -d --wait --remove-orphans --no-deps app")
  const caddyUp = remote.indexOf("up -d --wait --force-recreate --no-deps caddy")
  assert.ok(appUp > -1 && caddyUp > appUp, "caddy has to be recreated after the new app is healthy")
  assert.ok(!remote.includes("up -d --wait --remove-orphans\n"), "one up leaves the previous proxy running")
  assert.match(compose, /127\.0\.0\.1:8081\/health/)
  assert.match(caddy, /127\.0\.0\.1:8081/)
  assert.match(ready, /READY_STREAK:-3/)
  const install = workflow.indexOf("npx playwright install chromium --with-deps")
  const again = workflow.indexOf("bash deploy/ready.sh", install)
  const smoke = workflow.indexOf("npx playwright test", install)
  assert.ok(install > -1 && again > install && smoke > again, "the smoke has to wait until the new proxy is still answering")
})

test("the production image copies every module the client bundle imports", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile.prod"), "utf8")
  const entry = path.join(assetsDir, "js/app.js")
  assert.deepEqual(missingCopies(dockerfile, entry), [])
  const withoutModels = dockerfile.replace("COPY assets/models ./assets/models\n", "")
  const missing = missingCopies(withoutModels, entry)
  assert.ok(missing.some((line) => line.includes("assets/models/registry.js")))
})
