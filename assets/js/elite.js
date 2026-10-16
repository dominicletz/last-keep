export function eliteLook(row) {
  if (row?.kind === "boss") return "horned"
  if (row?.elite === "armored") return "plated"
  if (row?.elite === "fast") return "lean"
  if (row?.elite === "enraged") return "spiked"
  return "plain"
}
