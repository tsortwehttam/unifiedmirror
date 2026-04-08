import fs from "node:fs"
import path from "node:path"
import type { Platform, UnifiedRecord } from "../types"
import { readJsonl, resolveJsonlDest, writeJsonlAtomic } from "./JsonlUtils"

export type MergeBy = "id"
export type SortBy = "none" | "timestamp"
export type ShardMode = "month" | "none"

export type SyncManifest = {
  platform: Platform
  account: string
  kinds: string[]
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  rowCount: number
  firstTimestamp: string | undefined
  lastTimestamp: string | undefined
  lastSyncedAt: string
  shard: ShardMode
  mergeBy: MergeBy
  sortBy: SortBy
  options: Record<string, boolean | number | string | undefined>
}

export function mergeRecords(existing: UnifiedRecord[], incoming: UnifiedRecord[], mergeBy: MergeBy): UnifiedRecord[] {
  if (mergeBy === "id") {
    let out = new Map<string, UnifiedRecord>()
    for (let row of existing) out.set(row.id, row)
    for (let row of incoming) out.set(row.id, row)
    return Array.from(out.values())
  }
  return [...existing, ...incoming]
}

export function sortRecords(rows: UnifiedRecord[], sortBy: SortBy): UnifiedRecord[] {
  if (sortBy === "none") return [...rows]
  return [...rows].sort((a, b) => {
    let diff = Date.parse(a.timestamp) - Date.parse(b.timestamp)
    if (diff !== 0) return diff
    return a.id.localeCompare(b.id)
  })
}

export function monthShard(timestamp: string): string {
  let date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid message timestamp "${timestamp}"`)
  return date.toISOString().slice(0, 7)
}

export function shardRecords(rows: UnifiedRecord[], shard: ShardMode): Map<string, UnifiedRecord[]> {
  let out = new Map<string, UnifiedRecord[]>()
  for (let row of rows) {
    let key = shard === "month" ? monthShard(row.timestamp) : ""
    let list = out.get(key) ?? []
    list.push(row)
    out.set(key, list)
  }
  return out
}

function buildManifest(rows: UnifiedRecord[], params: {
  platform: Platform
  account: string
  kinds: string[]
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  shard: ShardMode
  mergeBy: MergeBy
  sortBy: SortBy
  options: Record<string, boolean | number | string | undefined>
}): SyncManifest {
  let sorted = sortRecords(rows, "timestamp")
  return {
    platform: params.platform,
    account: params.account,
    kinds: params.kinds,
    query: params.query,
    preset: params.preset,
    since: params.since,
    until: params.until,
    rowCount: rows.length,
    firstTimestamp: sorted[0]?.timestamp,
    lastTimestamp: sorted[sorted.length - 1]?.timestamp,
    lastSyncedAt: new Date().toISOString(),
    shard: params.shard,
    mergeBy: params.mergeBy,
    sortBy: params.sortBy,
    options: params.options,
  }
}

function resolveShardPath(destRoot: string, shard: ShardMode, key: string): string {
  if (shard === "month") return path.resolve(destRoot, key, "records.jsonl")
  return resolveJsonlDest(destRoot)
}

function resolveManifestPath(destRoot: string, shard: ShardMode, key: string): string {
  if (shard === "month") return path.resolve(destRoot, key, "meta.json")
  let jsonl = resolveJsonlDest(destRoot)
  return path.resolve(path.dirname(jsonl), "meta.json")
}

export function syncJsonl(params: {
  rows: UnifiedRecord[]
  destRoot: string
  platform: Platform
  account: string
  kinds: string[]
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  shard: ShardMode
  mergeBy: MergeBy
  sortBy: SortBy
  options: Record<string, boolean | number | string | undefined>
}): Array<{ shardKey: string; dest: string; rowCount: number; manifestPath: string }> {
  let groups = shardRecords(params.rows, params.shard)
  let out: Array<{ shardKey: string; dest: string; rowCount: number; manifestPath: string }> = []

  for (let [key, incoming] of groups) {
    let dest = resolveShardPath(params.destRoot, params.shard, key)
    let existing = readJsonl<UnifiedRecord>(dest)
    let merged = sortRecords(mergeRecords(existing, incoming, params.mergeBy), params.sortBy)
    writeJsonlAtomic(dest, merged)

    let manifestPath = resolveManifestPath(params.destRoot, params.shard, key)
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        buildManifest(merged, {
          platform: params.platform,
          account: params.account,
          kinds: params.kinds,
          query: params.query,
          preset: params.preset,
          since: params.since,
          until: params.until,
          shard: params.shard,
          mergeBy: params.mergeBy,
          sortBy: params.sortBy,
          options: params.options,
        }),
        null,
        2,
      ) + "\n",
    )

    out.push({ shardKey: key, dest, rowCount: merged.length, manifestPath })
  }

  return out
}
