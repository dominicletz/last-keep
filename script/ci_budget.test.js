const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const { test } = require("node:test")
const { DEPLOY_LIMIT_MS, deployOver, gateGaps, jobsIn, missingTimeout, overBudget } = require("./ci_jobs")

test("every CI job has a 10 minute timeout and the gate needs the rest", () => {
  const yaml = fs.readFileSync(path.join(__dirname, "../.github/workflows/ci.yml"), "utf8")
  const jobs = jobsIn(yaml)
  assert.ok(jobs.length >= 4)
  assert.deepEqual(missingTimeout(jobs), [])
  assert.deepEqual(gateGaps(jobs), [])
  assert.ok(jobs.some((job) => job.name === "browser"))
  assert.ok(jobs.some((job) => job.name === "perf"))
})

test("a job without timeout-minutes fails the budget", () => {
  const jobs = jobsIn("jobs:\n  unit:\n    runs-on: ubuntu-24.04\n  test:\n    timeout-minutes: 10\n    needs: [unit]\n")
  assert.deepEqual(missingTimeout(jobs), ["unit"])
})

test("a timeout above 10 minutes fails the budget", () => {
  const jobs = jobsIn("jobs:\n  unit:\n    timeout-minutes: 50\n  test:\n    timeout-minutes: 10\n    needs: [unit]\n")
  assert.deepEqual(missingTimeout(jobs), ["unit"])
})

test("the gate has to need every other job", () => {
  const jobs = jobsIn(
    "jobs:\n  unit:\n    timeout-minutes: 10\n  perf:\n    timeout-minutes: 10\n  test:\n    timeout-minutes: 10\n    needs: [unit]\n"
  )
  assert.deepEqual(gateGaps(jobs), ["perf"])
})

test("the browser install bounds apt before Playwright asks for deps", () => {
  const action = fs.readFileSync(path.join(__dirname, "../.github/actions/browser/action.yml"), "utf8")
  const deploy = fs.readFileSync(path.join(__dirname, "../.github/workflows/deploy.yml"), "utf8")
  const bound = fs.readFileSync(path.join(__dirname, "apt_bound.sh"), "utf8")
  const installAt = action.indexOf("npx playwright install chromium --with-deps")
  const boundAt = action.indexOf("bash script/apt_bound.sh")
  assert.ok(boundAt >= 0 && boundAt < installAt)
  const deployInstall = deploy.indexOf("npx playwright install chromium --with-deps")
  const deployBound = deploy.indexOf("bash script/apt_bound.sh")
  assert.ok(deployBound >= 0 && deployBound < deployInstall)
  assert.match(bound, /Acquire::http::Timeout "20"/)
  assert.match(bound, /azure\.archive\.ubuntu\.com/)
  assert.match(bound, /archive\.ubuntu\.com/)
})

test("the slowest completed job fails once it passes 10 minutes", () => {
  const start = "2026-10-31T12:00:00Z"
  const under = overBudget([
    { name: "unit", started_at: start, completed_at: "2026-10-31T12:07:00Z" },
    { name: "test", started_at: start, completed_at: null }
  ])
  assert.equal(under, null)
  const over = overBudget([
    { name: "browser (3)", started_at: start, completed_at: "2026-10-31T12:10:01Z" }
  ])
  assert.equal(over.name, "browser (3)")
  assert.ok(over.ms > 10 * 60 * 1000)
})

test("the smoke set covers a shared room, the night, a phone, and the join form", () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, "../e2e", name), "utf8")
  const tagged = (source) =>
    [...source.matchAll(/test\("([^"]+)", \{ tag: "@smoke" \}/g)].map((match) => match[1])
  const names = [...tagged(read("smoke.spec.js")), ...tagged(read("coop.spec.js")), ...tagged(read("mobile.spec.js"))]
  assert.ok(names.some((name) => /night opens wave 1/.test(name)))
  assert.ok(names.some((name) => /phone joins, walks with the stick/.test(name)))
  assert.ok(names.some((name) => /join form/.test(name)))
  assert.ok(!names.some((name) => /six seats/.test(name)))
  assert.ok(names.length <= 6, `the smoke set grew to ${names.length}`)
})

test("a deploy past its limit fails the time box", () => {
  const started = 1_800_000_000
  assert.equal(deployOver(started, started * 1000 + 4 * 60 * 1000).over, false)
  const over = deployOver(started, started * 1000 + DEPLOY_LIMIT_MS + 1000)
  assert.equal(over.over, true)
  assert.match(over.reason, /deploy ran \d+s/)
  assert.equal(deployOver(undefined, Date.now()).over, true)
  assert.ok(DEPLOY_LIMIT_MS < 10 * 60 * 1000)
})
