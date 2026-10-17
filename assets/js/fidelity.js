export function fidelityViolations(rows) {
  const last = new Map()
  const violations = []
  for (const row of rows || []) {
    const score = Number(row.score)
    const prev = last.get(row.asset)
    if (prev != null && score < prev && !String(row.reason || "").trim()) violations.push(row.asset)
    if (row.asset && Number.isFinite(score)) last.set(row.asset, score)
  }
  return violations
}

export function parseFidelityTable(markdown) {
  const lines = String(markdown || "").split("\n")
  const start = lines.findIndex((line) => line.trim() === "## Fidelity")
  if (start < 0) return []
  const rows = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break
    if (!line.startsWith("|")) continue
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 4) continue
    if (cells[0] === "asset" || cells[0].startsWith("---")) continue
    rows.push({ asset: cells[0], date: cells[1], score: cells[2], reason: cells[3] })
  }
  return rows
}
