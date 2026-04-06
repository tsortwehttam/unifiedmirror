import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fetchAttachment, selectorFromAttachment } from "../src/attachments"
import type { UnifiedMessage } from "../src/types"

test("fetchAttachment reads local Messages attachments by id", async () => {
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), "um-attachment-"))
  let file = path.join(dir, "sample.txt")
  fs.writeFileSync(file, "hello")

  let msg: UnifiedMessage = {
    id: "m1",
    platform: "messages",
    timestamp: "2026-04-06T00:00:00Z",
    subject: undefined,
    bodyText: undefined,
    bodyHtml: undefined,
    from: undefined,
    to: [],
    cc: [],
    bcc: [],
    attachments: [
      {
        id: "a1",
        filename: "sample.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        url: file,
      },
    ],
    threadId: undefined,
    platformMetadata: {
      platform: "messages",
      messageRowId: 1,
      messageGuid: "m1",
      chatRowId: undefined,
      chatGuid: undefined,
      chatIdentifier: undefined,
      service: undefined,
      handle: undefined,
      isFromMe: false,
    },
  }

  let data = await fetchAttachment(msg, selectorFromAttachment({ id: "a1", filename: undefined, index: undefined }), "default")
  assert.equal(data?.toString("utf8"), "hello")
})
