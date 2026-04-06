import type { Participant, UnifiedAttachment, UnifiedMessage } from "../../types"

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

function parseParticipants(raw: string | null): Participant[] {
  if (!raw) return []
  return Array.from(new Set(raw.split("\n").map(value => value.trim()).filter(Boolean))).map(address => ({
    address,
    name: undefined,
  }))
}

export function toUnifiedMessage(
  row: MessagesRow,
  opts: {
    attachments: UnifiedAttachment[]
    dateUnit: MessagesDateUnit
    me: string | undefined
  },
): UnifiedMessage {
  let chatParticipants = parseParticipants(row.chatHandles)
  let from: Participant | undefined =
    row.isFromMe === 1
      ? opts.me
        ? { address: opts.me, name: "me" }
        : { address: "me", name: undefined }
      : row.handle
        ? { address: row.handle, name: undefined }
        : undefined
  let to = row.isFromMe === 1 ? chatParticipants : [{ address: opts.me ?? "me", name: opts.me ? "me" : undefined }]
  let subject = row.chatName?.trim() || row.chatIdentifier?.trim() || row.handle?.trim() || row.service?.trim() || undefined

  return {
    id: row.guid,
    platform: "messages",
    timestamp: decodeAppleTime(row.date, opts.dateUnit),
    subject,
    bodyText: pickBodyText(row.text, row.attributedBody),
    bodyHtml: undefined,
    from,
    to,
    cc: [],
    bcc: [],
    attachments: opts.attachments,
    threadId: row.chatGuid ?? (row.chatRowId != null ? String(row.chatRowId) : undefined),
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
