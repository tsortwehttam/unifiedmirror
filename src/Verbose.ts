export function verboseLog(verbose: boolean, label: string, value: unknown): void {
  if (!verbose) return
  let payload = typeof value === "string" ? value : JSON.stringify(value)
  process.stderr.write(`[um] ${label}: ${payload}\n`)
}
