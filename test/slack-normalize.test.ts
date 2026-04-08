import assert from "node:assert/strict"
import test from "node:test"
import { toUnifiedRecord } from "../src/platforms/slack/toUnifiedRecord"

test("slack normalization keeps channel and file metadata", () => {
  let row = toUnifiedRecord(
    {
      ts: "1711274400.100000",
      user: "U1",
      text: "hello",
      thread_ts: undefined,
      team: "T1",
      permalink: "https://slack.example/message",
      bot_id: undefined,
      subtype: undefined,
      files: [
        {
          id: "F1",
          name: "report.pdf",
          title: undefined,
          mimetype: "application/pdf",
          size: 42,
          url_private: undefined,
          url_private_download: "https://download",
          permalink: undefined,
        },
      ],
      attachments: undefined,
    },
    {
      account: "default",
      channelId: "C1",
      channelName: "general",
      teamId: "T1",
      userCache: new Map([["U1", "Alice"]]),
      permalink: undefined,
    },
  )

  assert.equal(row.platform, "slack")
  assert.equal(row.from?.name, "Alice")
  assert.equal(row.to[0]?.address, "C1")
  assert.equal(row.attachments[0]?.filename, "report.pdf")
  assert.equal(row.kind, "message")
  assert.equal(row.platformMetadata.platform, "slack")
})
