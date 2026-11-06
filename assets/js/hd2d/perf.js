export function perfRequested(search) {
  const raw = String(search || "")
  const query = raw.startsWith("?") ? raw : `?${raw}`
  return new URLSearchParams(query).get("perf") === "1"
}

export function perfText(sample) {
  const frame = sample && Number.isFinite(sample.frameMs) ? `${sample.frameMs.toFixed(1)} ms` : "—"
  const submit = sample && Number.isFinite(sample.submitMs) ? ` / ${sample.submitMs.toFixed(1)} ms` : ""
  const driver = sample && sample.driver ? `  ${sample.driver}` : ""
  return `frame ${frame}${submit}${driver}`
}
