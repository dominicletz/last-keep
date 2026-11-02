const { DEPLOY_LIMIT_MS, deployOver } = require("./ci_jobs")

const result = deployOver(process.env.DEPLOY_STARTED, Date.now())
if (result.over) {
  console.error(`${result.reason}, the limit is ${DEPLOY_LIMIT_MS / 60000} minutes`)
  process.exit(1)
}
console.log(`deploy ran ${Math.round(result.ms / 1000)}s of ${DEPLOY_LIMIT_MS / 1000}s`)
