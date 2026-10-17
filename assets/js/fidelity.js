export function fidelityRows(markdown) {
  const section = markdown.split(/^## /m).find((block) => block.startsWith("Fidelity"))
  if (!section) return []
  const rows = []
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 4) continue
    if (cells[0] === "asset" || cells[0].includes("---")) continue
    rows.push({ asset: cells[0], date: cells[1], score: Number(cells[2]), reason: cells[3] })
  }
  return rows
}

export function fidelityProblems(rows) {
  const problems = []
  const best = new Map()
  for (const row of rows) {
    if (!Number.isInteger(row.score) || row.score < 1 || row.score > 5) {
      problems.push(`${row.asset} score ${row.score} is outside 1 to 5`)
    }
    const previous = best.get(row.asset)
    if (previous !== undefined && row.score < previous && row.reason.trim() === "") {
      problems.push(`${row.asset} dropped from ${previous} to ${row.score} without a reason`)
    }
    best.set(row.asset, previous === undefined ? row.score : Math.max(previous, row.score))
  }
  return problems
}
