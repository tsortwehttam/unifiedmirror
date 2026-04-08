import assert from "node:assert/strict"
import test from "node:test"
import { toUnifiedRecord } from "../src/platforms/gmail/toUnifiedRecord"

test("gmail normalization preserves attachment size when data is not inline", () => {
  let row = toUnifiedRecord({
    id: "m1",
    threadId: "t1",
    internalDate: String(Date.parse("2026-03-20T10:00:00Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [{ name: "From", value: "Alice <alice@example.com>" }],
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from("hi there", "utf8").toString("base64url"),
          },
        },
        {
          filename: "report.pdf",
          mimeType: "application/pdf",
          body: {
            attachmentId: "a1",
            size: 1234,
          },
        },
      ],
    },
  }, "default")

  assert.equal(row.attachments[0]?.filename, "report.pdf")
  assert.equal(row.attachments[0]?.sizeBytes, 1234)
})
