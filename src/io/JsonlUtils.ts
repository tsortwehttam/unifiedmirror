import fs from "node:fs"
import path from "node:path"

export function resolveJsonlDest(dest: string | undefined): string {
  let base = path.resolve(dest ?? process.cwd())
  if (path.extname(base) === ".jsonl") return base
  return path.resolve(base, "messages.jsonl")
}

export function appendJsonl(pathname: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true })
  if (rows.length === 0) return
  let body = rows.map(row => JSON.stringify(row)).join("\n") + "\n"
  fs.appendFileSync(pathname, body)
}
