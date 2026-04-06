import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { monthShard, syncJsonl } from "../src/io/SyncUtils"
import type { UnifiedMessage } from "../src/types"

function makeMessage(params: {
  id: string
  timestamp: string
  subject: string
}): UnifiedMessage {
  return {
    id: params.id,
    platform: "gmail",
    timestamp: params.timestamp,
    subject: params.subject,
    bodyText: params.subject,
    bodyHtml: undefined,
    from: undefined,
    to: [],
    cc: [],
    bcc: [],
    attachments: [],
    threadId: undefined,
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
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), "um-sync-"))

  let first = syncJsonl({
    rows: [
      makeMessage({ id: "b", timestamp: "2026-04-02T00:00:00Z", subject: "second" }),
      makeMessage({ id: "a", timestamp: "2026-04-01T00:00:00Z", subject: "first" }),
      makeMessage({ id: "m", timestamp: "2026-03-31T23:59:59Z", subject: "march" }),
    ],
    destRoot: dir,
    platform: "gmail",
    account: "default",
    query: "q1",
    preset: "primary-like",
    since: "2026-03-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    includeThreadReplies: undefined,
  })

  assert.equal(first.length, 2)
  let aprilPath = path.join(dir, "2026-04", "messages.jsonl")
  let aprilRows = fs
    .readFileSync(aprilPath, "utf8")
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as UnifiedMessage)
  assert.deepEqual(
    aprilRows.map(row => row.id),
    ["a", "b"],
  )

  syncJsonl({
    rows: [makeMessage({ id: "a", timestamp: "2026-04-03T00:00:00Z", subject: "updated" })],
    destRoot: dir,
    platform: "gmail",
    account: "default",
    query: "q2",
    preset: undefined,
    since: "2026-04-01T00:00:00Z",
    until: "2026-04-30T23:59:59Z",
    shard: "month",
    mergeBy: "id",
    sortBy: "timestamp",
    includeThreadReplies: undefined,
  })

  let updatedAprilRows = fs
    .readFileSync(aprilPath, "utf8")
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as UnifiedMessage)
  assert.deepEqual(
    updatedAprilRows.map(row => `${row.id}:${row.subject}`),
    ["b:second", "a:updated"],
  )

  let meta = JSON.parse(fs.readFileSync(path.join(dir, "2026-04", "meta.json"), "utf8")) as {
    rowCount: number
    query: string
    firstTimestamp: string
    lastTimestamp: string
  }
  assert.equal(meta.rowCount, 2)
  assert.equal(meta.query, "q2")
  assert.equal(meta.firstTimestamp, "2026-04-02T00:00:00Z")
  assert.equal(meta.lastTimestamp, "2026-04-03T00:00:00Z")
})
