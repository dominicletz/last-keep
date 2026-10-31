const assert = require("node:assert/strict")
const fs = require("fs")
const path = require("path")
const { test } = require("node:test")
const { gateGaps, jobsIn, missingTimeout, overBudget } = require("./ci_jobs")

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
