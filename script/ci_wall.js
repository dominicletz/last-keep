const { overBudget } = require("./ci_jobs")

async function runs() {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  })
  if (!response.ok) throw new Error(`jobs ${response.status}`)
  const body = await response.json()
  return body.jobs || []
}

async function main() {
  if (!process.env.GITHUB_RUN_ID) {
    console.log("duration check runs in CI")
    return
  }
  const jobs = await runs()
  const slow = overBudget(jobs)
  if (slow) {
    console.error(`${slow.name} ran ${Math.round(slow.ms / 1000)}s, over 10 minutes`)
    process.exit(1)
  }
  const done = jobs.filter((job) => job.completed_at && job.started_at)
  if (done.length === 0) throw new Error("no completed job")
  const worst = done
    .map((job) => ({ name: job.name, ms: new Date(job.completed_at) - new Date(job.started_at) }))
    .sort((a, b) => b.ms - a.ms)[0]
  console.log(`slowest completed job ${worst.name} ${Math.round(worst.ms / 1000)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
