import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import type { UnifiedAttachment, UnifiedRecord } from "../../types"
import { verboseLog } from "../../Verbose"
import { resolveMessagesAccountConfig } from "./accountFile"
import { toUnifiedRecord, type MessagesDateUnit, type MessagesRow } from "./toUnifiedRecord"

type MessageAttachmentRow = {
  messageId: number
  attachmentId: number
  filename: string | null
  mimeType: string | null
  sizeBytes: number | null
}

function parseTime(value: string | undefined): number | undefined {
  if (!value) return undefined
  let time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid time bound "${value}"`)
  return time
}

const APPLE_EPOCH_MS = 978307200000

function inferDateUnit(value: number): MessagesDateUnit {
  if (value > 10_000_000_000_000_000) return "ns"
  if (value > 10_000_000_000_000) return "us"
  if (value > 10_000_000_000) return "ms"
  return "s"
}

function encodeAppleTime(value: string | undefined, unit: MessagesDateUnit): number | undefined {
  let time = parseTime(value)
  if (time == null) return undefined
  let delta = time - APPLE_EPOCH_MS
  if (unit === "ns") return delta * 1_000_000
  if (unit === "us") return delta * 1000
  if (unit === "ms") return delta
  return Math.floor(delta / 1000)
}

function toTerms(query: string): string[] {
  return query
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
}

function buildWhere(params: {
  query: string
  since: string | undefined
  until: string | undefined
  dateUnit: MessagesDateUnit
}): { clause: string; values: Array<number | string> } {
  let values: Array<number | string> = []
  let parts: string[] = []
  let since = encodeAppleTime(params.since, params.dateUnit)
  let until = encodeAppleTime(params.until, params.dateUnit)
  if (since != null) {
    parts.push("m.date >= ?")
    values.push(since)
  }
  if (until != null) {
    parts.push("m.date <= ?")
    values.push(until)
  }
  let terms = toTerms(params.query)
  if (terms.length) {
    let one = "(c.chat_identifier = ? OR c.guid = ? OR h.id = ?)"
    parts.push(`(${terms.map(() => one).join(" OR ")})`)
    for (let term of terms) values.push(term, term, term)
  }
  let clause = parts.length ? `WHERE ${parts.join(" AND ")}` : ""
  return { clause, values }
}

function openDatabase(dbPath: string): Database.Database {
  if (!fs.existsSync(dbPath)) throw new Error(`Messages DB not found: ${dbPath}`)
  return new Database(dbPath, { readonly: true, fileMustExist: true })
}

function detectDateUnit(db: Database.Database): MessagesDateUnit {
  let row = db.prepare("SELECT MAX(date) AS maxDate FROM message").get() as { maxDate: number | null }
  return inferDateUnit(row.maxDate ?? 0)
}

function listRows(
  db: Database.Database,
  params: {
    query: string
    since: string | undefined
    until: string | undefined
    maxResults: number
    dateUnit: MessagesDateUnit
  },
): MessagesRow[] {
  let { clause, values } = buildWhere(params)
  let sql = `
    SELECT
      m.ROWID AS rowid,
      m.guid AS guid,
      m.text AS text,
      m.attributedBody AS attributedBody,
      m.service AS service,
      m.is_from_me AS isFromMe,
      m.date AS date,
      h.id AS handle,
      c.ROWID AS chatRowId,
      c.guid AS chatGuid,
      c.chat_identifier AS chatIdentifier,
      c.display_name AS chatName,
      (
        SELECT group_concat(h2.id, char(10))
        FROM chat_handle_join chj2
        JOIN handle h2 ON h2.ROWID = chj2.handle_id
        WHERE chj2.chat_id = c.ROWID
      ) AS chatHandles
    FROM message m
    LEFT JOIN handle h ON h.ROWID = m.handle_id
    LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
    LEFT JOIN chat c ON c.ROWID = cmj.chat_id
    ${clause}
    ORDER BY m.date DESC
    LIMIT ?
  `
  return db.prepare(sql).all(...values, params.maxResults) as MessagesRow[]
}

function listAttachments(db: Database.Database, ids: number[], attachmentsRoot: string): Map<number, UnifiedAttachment[]> {
  let out = new Map<number, UnifiedAttachment[]>()
  if (!ids.length) return out
  let placeholders = ids.map(() => "?").join(", ")
  let sql = `
    SELECT
      maj.message_id AS messageId,
      a.ROWID AS attachmentId,
      a.filename AS filename,
      a.mime_type AS mimeType,
      a.total_bytes AS sizeBytes
    FROM message_attachment_join maj
    JOIN attachment a ON a.ROWID = maj.attachment_id
    WHERE maj.message_id IN (${placeholders})
    ORDER BY maj.message_id ASC, a.ROWID ASC
  `
  let rows = db.prepare(sql).all(...ids) as MessageAttachmentRow[]
  for (let row of rows) {
    if (!row.filename) continue
    let list = out.get(row.messageId) ?? []
    list.push({
      id: String(row.attachmentId),
      filename: path.basename(row.filename),
      mimeType: row.mimeType ?? undefined,
      sizeBytes: row.sizeBytes ?? undefined,
      url: row.filename.startsWith("~/")
        ? path.resolve(attachmentsRoot, row.filename.replace(/^~\/Library\/Messages\/Attachments\//, ""))
        : row.filename,
    })
    out.set(row.messageId, list)
  }
  return out
}

export function buildMessagesQuery(params: {
  query: string
  since: string | undefined
  until: string | undefined
}): { terms: string[]; since: number | undefined; until: number | undefined } {
  return {
    terms: toTerms(params.query),
    since: parseTime(params.since),
    until: parseTime(params.until),
  }
}

export async function listMessagesMessages(params: {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}): Promise<UnifiedRecord[]> {
  let config = resolveMessagesAccountConfig(params.account)
  verboseLog(params.verbose, "messages db", { dbPath: config.dbPath, attachmentsRoot: config.attachmentsRoot })
  let db = openDatabase(config.dbPath)
  try {
    let dateUnit = detectDateUnit(db)
    verboseLog(params.verbose, "messages date unit", dateUnit)
    let rows = listRows(db, { ...params, dateUnit })
    let attachments = listAttachments(
      db,
      rows.map(row => row.rowid),
      config.attachmentsRoot,
    )
    return rows.map(row =>
      toUnifiedRecord(row, {
        account: params.account,
        attachments: attachments.get(row.rowid) ?? [],
        dateUnit,
        me: config.me,
      }),
    )
  } finally {
    db.close()
  }
}
