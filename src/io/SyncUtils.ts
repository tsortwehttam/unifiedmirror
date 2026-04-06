import fs from "node:fs"
import path from "node:path"
import type { Platform, UnifiedMessage } from "../types"
import { readJsonl, resolveJsonlDest, writeJsonlAtomic } from "./JsonlUtils"

export type MergeBy = "id"
export type SortBy = "none" | "timestamp"
export type ShardMode = "month" | "none"

export type SyncManifest = {
  platform: Platform
  account: string
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
  includeThreadReplies: boolean | undefined
}

export function mergeMessages(existing: UnifiedMessage[], incoming: UnifiedMessage[], mergeBy: MergeBy): UnifiedMessage[] {
  if (mergeBy === "id") {
    let out = new Map<string, UnifiedMessage>()
    for (let row of existing) out.set(row.id, row)
    for (let row of incoming) out.set(row.id, row)
    return Array.from(out.values())
  }
  return [...existing, ...incoming]
}

export function sortMessages(rows: UnifiedMessage[], sortBy: SortBy): UnifiedMessage[] {
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

export function shardMessages(rows: UnifiedMessage[], shard: ShardMode): Map<string, UnifiedMessage[]> {
  let out = new Map<string, UnifiedMessage[]>()
  for (let row of rows) {
    let key = shard === "month" ? monthShard(row.timestamp) : ""
    let list = out.get(key) ?? []
    list.push(row)
    out.set(key, list)
  }
  return out
}

function buildManifest(rows: UnifiedMessage[], params: {
  platform: Platform
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  shard: ShardMode
  mergeBy: MergeBy
  sortBy: SortBy
  includeThreadReplies: boolean | undefined
}): SyncManifest {
  let sorted = sortMessages(rows, "timestamp")
  return {
    platform: params.platform,
    account: params.account,
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
    includeThreadReplies: params.includeThreadReplies,
  }
}

function resolveShardPath(destRoot: string, shard: ShardMode, key: string): string {
  if (shard === "month") return path.resolve(destRoot, key, "messages.jsonl")
  return resolveJsonlDest(destRoot)
}

function resolveManifestPath(destRoot: string, shard: ShardMode, key: string): string {
  if (shard === "month") return path.resolve(destRoot, key, "meta.json")
  let jsonl = resolveJsonlDest(destRoot)
  return path.resolve(path.dirname(jsonl), "meta.json")
}

export function syncJsonl(params: {
  rows: UnifiedMessage[]
  destRoot: string
  platform: Platform
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  shard: ShardMode
  mergeBy: MergeBy
  sortBy: SortBy
  includeThreadReplies: boolean | undefined
}): Array<{ shardKey: string; dest: string; rowCount: number; manifestPath: string }> {
  let groups = shardMessages(params.rows, params.shard)
  let out: Array<{ shardKey: string; dest: string; rowCount: number; manifestPath: string }> = []

  for (let [key, incoming] of groups) {
    let dest = resolveShardPath(params.destRoot, params.shard, key)
    let existing = readJsonl<UnifiedMessage>(dest)
    let merged = sortMessages(mergeMessages(existing, incoming, params.mergeBy), params.sortBy)
    writeJsonlAtomic(dest, merged)

    let manifestPath = resolveManifestPath(params.destRoot, params.shard, key)
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        buildManifest(merged, {
          platform: params.platform,
          account: params.account,
          query: params.query,
          preset: params.preset,
          since: params.since,
          until: params.until,
          shard: params.shard,
          mergeBy: params.mergeBy,
          sortBy: params.sortBy,
          includeThreadReplies: params.includeThreadReplies,
        }),
        null,
        2,
      ) + "\n",
    )

    out.push({ shardKey: key, dest, rowCount: merged.length, manifestPath })
  }

  return out
}
