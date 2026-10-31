// Jobs in .github/workflows/ci.yml. The wall-clock rule is timeout-minutes
// 10 on every job, and the required check is the job named test.

function jobsIn(yaml) {
  const lines = yaml.split(/\n/)
  const found = []
  let inJobs = false
  let current = null
  for (const line of lines) {
    if (!inJobs) {
      if (line === "jobs:") inJobs = true
      continue
    }
    if (/^\S/.test(line)) break
    const name = line.match(/^  ([A-Za-z0-9_-]+):\s*$/)
    if (name) {
      current = { name: name[1], timeout: null, needs: [] }
      found.push(current)
      continue
    }
    if (!current) continue
    const timeout = line.match(/^    timeout-minutes:\s*(\d+)\s*$/)
    if (timeout) current.timeout = Number(timeout[1])
    const needs = line.match(/^    needs:\s*\[(.*)\]\s*$/)
    if (needs) {
      current.needs = needs[1]
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    }
  }
  return found
}

function missingTimeout(jobs) {
  return jobs.filter((job) => job.timeout !== 10).map((job) => job.name)
}

function gateGaps(jobs) {
  const gate = jobs.find((job) => job.name === "test")
  if (!gate) return ["job test is missing"]
  const others = jobs.filter((job) => job.name !== "test").map((job) => job.name)
  const needs = new Set(gate.needs)
  return others.filter((name) => !needs.has(name))
}

// completed_at minus started_at. A job still running has no completed_at.
// The limit is 10 minutes. A successful job cannot outlive timeout-minutes,
// and this rejects a run whose slowest completed job went past it.
function overBudget(runs, limitMs = 10 * 60 * 1000) {
  let slowest = null
  for (const job of runs) {
    if (!job.completed_at || !job.started_at) continue
    const ms = new Date(job.completed_at) - new Date(job.started_at)
    if (!slowest || ms > slowest.ms) slowest = { name: job.name, ms }
  }
  if (!slowest || slowest.ms <= limitMs) return null
  return slowest
}

module.exports = { jobsIn, missingTimeout, gateGaps, overBudget }
