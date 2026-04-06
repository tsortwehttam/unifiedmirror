import assert from "node:assert/strict"
import test from "node:test"
import { collectUserIds, shouldFetchReplies, toThreadReplies } from "../src/platforms/slack/SlackSource"

test("collectUserIds gathers distinct user ids", () => {
  let ids = collectUserIds([
    { ts: "1", user: "U1", text: undefined, thread_ts: undefined, team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
    { ts: "2", user: "U2", text: undefined, thread_ts: undefined, team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
    { ts: "3", user: "U1", text: undefined, thread_ts: undefined, team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
  ])

  assert.deepEqual(Array.from(ids).sort(), ["U1", "U2"])
})

test("shouldFetchReplies only flags threaded parents with reply counts", () => {
  assert.equal(
    shouldFetchReplies({
      ts: "1",
      user: "U1",
      text: "parent",
      thread_ts: "1",
      team: undefined,
      permalink: undefined,
      bot_id: undefined,
      subtype: undefined,
      files: undefined,
      attachments: undefined,
      reply_count: 2,
    }),
    true,
  )

  assert.equal(
    shouldFetchReplies({
      ts: "2",
      user: "U1",
      text: "single",
      thread_ts: undefined,
      team: undefined,
      permalink: undefined,
      bot_id: undefined,
      subtype: undefined,
      files: undefined,
      attachments: undefined,
      reply_count: 0,
    }),
    false,
  )
})

test("toThreadReplies excludes the parent message", () => {
  let replies = toThreadReplies(
    [
      { ts: "1", user: "U1", text: "parent", thread_ts: "1", team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
      { ts: "1.1", user: "U2", text: "reply 1", thread_ts: "1", team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
      { ts: "1.2", user: "U3", text: "reply 2", thread_ts: "1", team: undefined, permalink: undefined, bot_id: undefined, subtype: undefined, files: undefined, attachments: undefined },
    ],
    "1",
  )

  assert.deepEqual(
    replies.map(item => item.ts),
    ["1.1", "1.2"],
  )
})
