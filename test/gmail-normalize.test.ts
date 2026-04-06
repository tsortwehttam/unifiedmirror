import assert from "node:assert/strict"
import test from "node:test"
import { toUnifiedMessage } from "../src/platforms/gmail/toUnifiedMessage"

test("gmail normalization extracts participants and bodies", () => {
  let row = toUnifiedMessage({
    id: "m1",
    threadId: "t1",
    internalDate: String(Date.parse("2026-03-20T10:00:00Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Alice <alice@example.com>" },
        { name: "To", value: "Bob <bob@example.com>" },
        { name: "Cc", value: "Carol <carol@example.com>" },
        { name: "Subject", value: "Hello" },
        { name: "Message-ID", value: "<m1@example.com>" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from("hi there", "utf8").toString("base64url"),
          },
        },
      ],
    },
  })

  assert.equal(row.platform, "gmail")
  assert.equal(row.from?.address, "alice@example.com")
  assert.equal(row.to[0]?.address, "bob@example.com")
  assert.equal(row.cc[0]?.address, "carol@example.com")
  assert.equal(row.bodyText, "hi there")
  assert.equal(row.platformMetadata.platform, "gmail")
})
