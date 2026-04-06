import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import Database from "better-sqlite3"
import { listMessagesMessages } from "../src/platforms/messages/MessagesSource"

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  let originals: Record<string, string | undefined> = {}
  for (let key of Object.keys(vars)) {
    originals[key] = process.env[key]
    if (vars[key] === undefined) delete process.env[key]
    else process.env[key] = vars[key]
  }
  return fn().finally(() => {
    for (let key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key]
      else process.env[key] = originals[key]
    }
  })
}

function toAppleTime(value: string): number {
  return (Date.parse(value) - 978307200000) * 1_000_000
}

function setupDb(dbPath: string): void {
  let db = new Database(dbPath)
  try {
    db.exec(`
      CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT);
      CREATE TABLE chat (ROWID INTEGER PRIMARY KEY, guid TEXT, chat_identifier TEXT, display_name TEXT);
      CREATE TABLE message (
        ROWID INTEGER PRIMARY KEY,
        guid TEXT,
        text TEXT,
        attributedBody BLOB,
        service TEXT,
        is_from_me INTEGER,
        handle_id INTEGER,
        date INTEGER
      );
      CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
      CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
      CREATE TABLE attachment (ROWID INTEGER PRIMARY KEY, filename TEXT, mime_type TEXT, total_bytes INTEGER);
      CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
    `)
    db.prepare(`INSERT INTO handle (ROWID, id) VALUES (?, ?)`).run(1, "+15551234567")
    db.prepare(`INSERT INTO chat (ROWID, guid, chat_identifier, display_name) VALUES (?, ?, ?, ?)`).run(
      1,
      "iMessage;-;+15551234567",
      "+15551234567",
      "Alice",
    )
    db.prepare(`INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)`).run(1, 1)
    db.prepare(
      `INSERT INTO message (ROWID, guid, text, attributedBody, service, is_from_me, handle_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, "msg-1", "Hi from Alice", null, "iMessage", 0, 1, toAppleTime("2026-04-05T12:00:00Z"))
    db.prepare(
      `INSERT INTO message (ROWID, guid, text, attributedBody, service, is_from_me, handle_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(2, "msg-2", "Photo attached", null, "iMessage", 1, null, toAppleTime("2026-04-05T12:05:00Z"))
    db.prepare(`INSERT INTO chat_message_join (chat_id, message_id) VALUES (?, ?)`).run(1, 1)
    db.prepare(`INSERT INTO chat_message_join (chat_id, message_id) VALUES (?, ?)`).run(1, 2)
    db.prepare(`INSERT INTO attachment (ROWID, filename, mime_type, total_bytes) VALUES (?, ?, ?, ?)`).run(
      1,
      "~/Library/Messages/Attachments/f1/test.jpg",
      "image/jpeg",
      1234,
    )
    db.prepare(`INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (?, ?)`).run(2, 1)
  } finally {
    db.close()
  }
}

test("listMessagesMessages reads macOS Messages rows into unified messages", async () => {
  let dir = fs.mkdtempSync(path.resolve(os.tmpdir(), "um-messages-test-"))
  let dbPath = path.resolve(dir, "chat.db")
  let attachmentsRoot = path.resolve(dir, "Attachments")
  fs.mkdirSync(attachmentsRoot, { recursive: true })
  setupDb(dbPath)

  await withEnv(
    {
      UM_MESSAGES_DB_PATH: dbPath,
      UM_MESSAGES_ATTACHMENTS_ROOT: attachmentsRoot,
      UM_MESSAGES_ME: "me@example.com",
    },
    async () => {
      let rows = await listMessagesMessages({
        account: "default",
        query: "+15551234567",
        preset: undefined,
        since: "2026-04-05T11:59:00Z",
        until: "2026-04-05T12:06:00Z",
        maxResults: 10,
        verbose: false,
      })

      assert.equal(rows.length, 2)
      assert.equal(rows[0].id, "msg-2")
      assert.equal(rows[0].platform, "messages")
      assert.equal(rows[0].from?.address, "me@example.com")
      assert.deepEqual(rows[0].to, [{ address: "+15551234567", name: undefined }])
      assert.equal(rows[0].attachments[0]?.filename, "test.jpg")
      assert.equal(rows[0].attachments[0]?.url, path.resolve(attachmentsRoot, "f1/test.jpg"))
      assert.equal(rows[0].threadId, "iMessage;-;+15551234567")
      assert.equal(rows[1].from?.address, "+15551234567")
      assert.deepEqual(rows[1].to, [{ address: "me@example.com", name: "me" }])
      assert.equal(rows[1].bodyText, "Hi from Alice")
      assert.equal(rows[1].timestamp, "2026-04-05T12:00:00.000Z")
    },
  )
})
