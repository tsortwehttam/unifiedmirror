import type { UnifiedAttachment, UnifiedParty, UnifiedRecord } from "../../types"
import { buildRecordId, dedupeParties, trimSummary } from "../PlatformUtils"

export type MessagesRow = {
  rowid: number
  guid: string
  text: string | null
  attributedBody: Buffer | null
  service: string | null
  isFromMe: number
  date: number
  handle: string | null
  chatRowId: number | null
  chatGuid: string | null
  chatIdentifier: string | null
  chatName: string | null
  chatHandles: string | null
}

export type MessagesDateUnit = "ns" | "us" | "ms" | "s"

const APPLE_EPOCH_MS = 978307200000

function decodeAppleTime(value: number, unit: MessagesDateUnit): string {
  if (unit === "ns") return new Date(APPLE_EPOCH_MS + value / 1_000_000).toISOString()
  if (unit === "us") return new Date(APPLE_EPOCH_MS + value / 1000).toISOString()
  if (unit === "ms") return new Date(APPLE_EPOCH_MS + value).toISOString()
  return new Date(APPLE_EPOCH_MS + value * 1000).toISOString()
}

function pickBodyText(text: string | null, attributedBody: Buffer | null): string | undefined {
  if (text?.trim()) return text.trim()
  if (!attributedBody) return undefined
  let raw = attributedBody
    .toString("utf8")
    .replace(/\u0000/g, "")
    .replace(/[^\p{L}\p{N}\p{P}\p{S}\p{Z}\n\r\t]/gu, "")
    .trim()
  if (!raw) return undefined
  let parts = raw
    .split(/(?=NSString)|NSDictionary|NS[A-Z][A-Za-z]+/g)
    .map(value => value.replace(/^NSString/, "").trim())
    .filter(value => value.length >= 2)
  return (parts[parts.length - 1] ?? raw).trim() || undefined
}

function parseParties(raw: string | null): UnifiedParty[] {
  if (!raw) return []
  return Array.from(new Set(raw.split("\n").map(value => value.trim()).filter(Boolean))).map(address => ({
    id: undefined,
    address,
    name: undefined,
    role: "participant",
  }))
}

export function toUnifiedRecord(
  row: MessagesRow,
  opts: {
    account: string
    attachments: UnifiedAttachment[]
    dateUnit: MessagesDateUnit
    me: string | undefined
  },
): UnifiedRecord {
  let chatParticipants = parseParties(row.chatHandles)
  let from: UnifiedParty | undefined =
    row.isFromMe === 1
      ? opts.me
        ? { id: undefined, address: opts.me, name: "me", role: "sender" }
        : { id: undefined, address: "me", name: undefined, role: "sender" }
      : row.handle
        ? { id: undefined, address: row.handle, name: undefined, role: "sender" }
        : undefined
  let to =
    row.isFromMe === 1
      ? chatParticipants.map(party => ({ ...party, role: "recipient" }))
      : [{ id: undefined, address: opts.me ?? "me", name: opts.me ? "me" : undefined, role: "recipient" }]
  let subject = row.chatName?.trim() || row.chatIdentifier?.trim() || row.handle?.trim() || row.service?.trim() || undefined
  let timestamp = decodeAppleTime(row.date, opts.dateUnit)
  let threadNative = row.chatGuid ?? (row.chatRowId != null ? String(row.chatRowId) : undefined)

  return {
    id: buildRecordId("messages", opts.account, "message", row.guid),
    kind: "message",
    platform: "messages",
    account: opts.account,
    timestamp,
    timestamps: {
      created: timestamp,
      updated: undefined,
      occurred: timestamp,
      sent: row.isFromMe === 1 ? timestamp : undefined,
      received: row.isFromMe === 1 ? undefined : timestamp,
    },
    subject,
    summary: trimSummary(pickBodyText(row.text, row.attributedBody)),
    bodyText: pickBodyText(row.text, row.attributedBody),
    bodyHtml: undefined,
    from,
    to,
    cc: [],
    bcc: [],
    participants: dedupeParties([from, ...to, ...chatParticipants]),
    attachments: opts.attachments,
    amounts: [],
    tags: row.service ? [row.service] : [],
    status: undefined,
    url: undefined,
    threadId: threadNative ? buildRecordId("messages", opts.account, "message", "thread", threadNative) : undefined,
    parentId: undefined,
    platformMetadata: {
      platform: "messages",
      messageRowId: row.rowid,
      messageGuid: row.guid,
      chatRowId: row.chatRowId ?? undefined,
      chatGuid: row.chatGuid ?? undefined,
      chatIdentifier: row.chatIdentifier ?? undefined,
      service: row.service ?? undefined,
      handle: row.handle ?? undefined,
      isFromMe: row.isFromMe === 1,
    },
  }
}
