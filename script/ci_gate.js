const names = ["UNIT", "BROWSER", "PERF", "MATCH", "BUDGET"]
const bad = names.filter((name) => process.env[name] !== "success")
if (bad.length) {
  console.error(bad.map((name) => `${name}=${process.env[name]}`).join(" "))
  process.exit(1)
}
console.log("unit browser perf match budget succeeded")
