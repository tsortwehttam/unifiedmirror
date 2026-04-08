import fs from "node:fs"
import path from "node:path"

export function resolveJsonlDest(dest: string | undefined): string {
  let base = path.resolve(dest ?? process.cwd())
  if (path.extname(base) === ".jsonl") return base
  return path.resolve(base, "records.jsonl")
}

export function appendJsonl(pathname: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true })
  if (rows.length === 0) return
  let body = rows.map(row => JSON.stringify(row)).join("\n") + "\n"
  fs.appendFileSync(pathname, body)
}

export function readJsonl<T>(pathname: string): T[] {
  if (!fs.existsSync(pathname)) return []
  let raw = fs.readFileSync(pathname, "utf8").trim()
  if (!raw) return []
  return raw
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as T)
}

export function writeJsonlAtomic(pathname: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true })
  let temp = path.resolve(path.dirname(pathname), `${path.basename(pathname)}.tmp`)
  let body = rows.length ? rows.map(row => JSON.stringify(row)).join("\n") + "\n" : ""
  fs.writeFileSync(temp, body)
  fs.renameSync(temp, pathname)
}
