import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { monthShard, syncJsonl } from "../src/io/SyncUtils"
import type { UnifiedRecord } from "../src/types"

function makeRecord(params: {
  id: string
  timestamp: string
  subject: string
}): UnifiedRecord {
  return {
    id: `gmail:default:message:${params.id}`,
    kind: "message",
    platform: "gmail",
    account: "default",
    timestamp: params.timestamp,
    timestamps: {
      created: params.timestamp,
      updated: undefined,
      occurred: params.timestamp,
      sent: params.timestamp,
      received: params.timestamp,
    },
    subject: params.subject,
    summary: params.subject,
    bodyText: params.subject,
    bodyHtml: undefined,
    from: undefined,
    to: [],
    cc: [],
    bcc: [],
    participants: [],
    attachments: [],
    amounts: [],
    tags: [],
    status: undefined,
    url: undefined,
    threadId: undefined,
    parentId: undefined,
    platformMetadata: {
      platform: "gmail",
      messageId: params.id,
      threadId: undefined,
      rfc822MessageId: undefined,
      labelIds: [],
      headers: {},
    },
  }
}

test("monthShard buckets timestamps by UTC month", () => {
  assert.equal(monthShard("2026-04-06T12:34:56Z"), "2026-04")
})

test("syncJsonl merges by id, sorts by timestamp, and writes manifests per month", () => {
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), "unifiedmirror-sync-"))

  let first = syncJsonl({
    rows: [
      makeRecord({ id: "b", timestamp: "2026-04-02T00:00:00Z", subject: "second" }),
      makeRecord({ id: "a", timestamp: "2026-04-01T00:00:00Z", subject: "first" }),
      makeRecord({ id: "m", timestamp: "2026-03-31T23:59:59Z", subject: "march" }),
    ],
    destRoot: dir,
    platform: "gmail",
    account: "default",
    kinds: ["message"],
    query: "q1",
    preset: "primary-like",
    since: "2026-03-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    options: {},
  })

  assert.equal(first.length, 2)
  let aprilPath = path.join(dir, "2026-04", "records.jsonl")
  let aprilRows = fs
    .readFileSync(aprilPath, "utf8")
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as UnifiedRecord)
  assert.deepEqual(
    aprilRows.map(row => row.id),
    ["gmail:default:message:a", "gmail:default:message:b"],
  )

  syncJsonl({
    rows: [makeRecord({ id: "a", timestamp: "2026-04-03T00:00:00Z", subject: "updated" })],
    destRoot: dir,
    platform: "gmail",
    account: "default",
    kinds: ["message"],
    query: "q2",
    preset: undefined,
    since: "2026-04-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    options: {},
  })

  let updatedAprilRows = fs
    .readFileSync(aprilPath, "utf8")
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as UnifiedRecord)
  assert.deepEqual(
    updatedAprilRows.map(row => `${row.id}:${row.subject}`),
    ["gmail:default:message:b:second", "gmail:default:message:a:updated"],
  )

  let meta = JSON.parse(fs.readFileSync(path.join(dir, "2026-04", "meta.json"), "utf8")) as {
    rowCount: number
    query: string
    firstTimestamp: string
    lastTimestamp: string
    kinds: string[]
  }
  assert.equal(meta.rowCount, 2)
  assert.equal(meta.query, "q2")
  assert.equal(meta.firstTimestamp, "2026-04-02T00:00:00Z")
  assert.equal(meta.lastTimestamp, "2026-04-03T00:00:00Z")
  assert.deepEqual(meta.kinds, ["message"])
})

function readTree(dir: string): Map<string, string> {
  let out = new Map<string, string>()

  function walk(root: string): void {
    for (let name of fs.readdirSync(root)) {
      let pathname = path.join(root, name)
      let rel = path.relative(dir, pathname)
      let stat = fs.statSync(pathname)
      if (stat.isDirectory()) {
        walk(pathname)
        continue
      }
      out.set(rel, fs.readFileSync(pathname, "utf8"))
    }
  }

  walk(dir)
  return out
}

function normalizeTree(tree: Map<string, string>): Map<string, string> {
  let out = new Map<string, string>()
  for (let [rel, content] of tree) {
    if (!rel.endsWith("meta.json")) {
      out.set(rel, content)
      continue
    }
    let meta = JSON.parse(content) as Record<string, unknown>
    meta.lastSyncedAt = "<normalized>"
    out.set(rel, JSON.stringify(meta, null, 2) + "\n")
  }
  return out
}

test("incremental sync writes match one-shot sync output", () => {
  let fullDir = fs.mkdtempSync(path.join(os.tmpdir(), "unifiedmirror-sync-full-"))
  let batchDir = fs.mkdtempSync(path.join(os.tmpdir(), "unifiedmirror-sync-batch-"))
  let rows = [
    makeRecord({ id: "m", timestamp: "2026-03-31T23:59:59Z", subject: "march" }),
    makeRecord({ id: "a", timestamp: "2026-04-01T00:00:00Z", subject: "first" }),
    makeRecord({ id: "b", timestamp: "2026-04-02T00:00:00Z", subject: "second" }),
    makeRecord({ id: "a", timestamp: "2026-04-03T00:00:00Z", subject: "updated" }),
  ]

  syncJsonl({
    rows,
    destRoot: fullDir,
    platform: "gmail",
    account: "default",
    kinds: ["message"],
    query: "q",
    preset: undefined,
    since: "2026-03-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    options: {},
  })

  syncJsonl({
    rows: rows.slice(0, 2),
    destRoot: batchDir,
    platform: "gmail",
    account: "default",
    kinds: ["message"],
    query: "q",
    preset: undefined,
    since: "2026-03-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    options: {},
  })

  syncJsonl({
    rows: rows.slice(2),
    destRoot: batchDir,
    platform: "gmail",
    account: "default",
    kinds: ["message"],
    query: "q",
    preset: undefined,
    since: "2026-03-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    options: {},
  })

  assert.deepEqual(normalizeTree(readTree(batchDir)), normalizeTree(readTree(fullDir)))
})
