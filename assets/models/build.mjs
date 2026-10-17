import { checkModels } from "./run.js"

const writeGolden = process.argv.includes("--write-golden")
const result = checkModels({ writeGolden })
if (!result.ok) {
  for (const problem of result.problems) console.error(problem)
  process.exit(1)
}
console.log(`models ok (${result.rendered.length} assets)`)
