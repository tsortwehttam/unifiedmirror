import type { gmail_v1 } from "googleapis"
import type { UnifiedAttachment, UnifiedParty, UnifiedRecord } from "../../types"
import { buildRecordId, dedupeParties, trimSummary } from "../PlatformUtils"
import { collectAttachments, headerMap, pickBody } from "./GmailMessageHelpers"

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function stripQuotedReply(text: string): string {
  let lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (/^On .{10,200}wrote:\s*$/.test(lines[i])) {
      return lines.slice(0, i).join("\n").trimEnd()
    }
    let trimmed = lines[i].trim()
    if (trimmed.length >= 20 && /^_+$/.test(trimmed)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j].trim().startsWith("From:")) {
          return lines.slice(0, i).join("\n").trimEnd()
        }
      }
    }
  }
  return text
}

export function isCalendarInviteSubject(subject: string | undefined): boolean {
  if (!subject) return false
  return /^(Accepted|Declined|Tentative|Updated invitation|Invitation|Canceled):/i.test(subject)
}

function parseParty(raw: string): UnifiedParty {
  let match = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      id: undefined,
      name: match[1].trim().replace(/^"|"$/g, ""),
      address: match[2].trim(),
      role: undefined,
    }
  }
  return { id: undefined, address: raw.trim(), name: undefined, role: undefined }
}

function parseParties(raw: string | undefined): UnifiedParty[] {
  if (!raw) return []
  return raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .map(parseParty)
}

export function toUnifiedRecord(msg: gmail_v1.Schema$Message, account: string): UnifiedRecord {
  let headers = headerMap(msg)
  let body = pickBody(msg.payload ?? undefined)
  let attachments: UnifiedAttachment[] = collectAttachments(msg.payload ?? undefined).map(item => ({
    id: item.attachmentId,
    filename: item.filename,
    mimeType: item.mimeType,
    sizeBytes: item.inlineData ? Buffer.from(item.inlineData, "base64").length : item.sizeBytes,
    url: undefined,
  }))
  let timestamp = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : headers.date
      ? new Date(headers.date).toISOString()
      : new Date().toISOString()
  let from = headers.from ? parseParty(headers.from) : undefined
  let to = parseParties(headers.to)
  let cc = parseParties(headers.cc)
  let bcc = parseParties(headers.bcc)
  let threadId = msg.threadId ? buildRecordId("gmail", account, "message", "thread", msg.threadId) : undefined
  let rawBody = body.text ?? (body.html ? stripHtml(body.html) : undefined)
  let bodyText = rawBody ? stripQuotedReply(rawBody) : undefined

  return {
    id: buildRecordId("gmail", account, "message", msg.id ?? ""),
    kind: "message",
    platform: "gmail",
    account,
    timestamp,
    timestamps: {
      created: timestamp,
      updated: undefined,
      occurred: timestamp,
      sent: headers.date ? new Date(headers.date).toISOString() : undefined,
      received: timestamp,
    },
    subject: headers.subject,
    summary: trimSummary(bodyText),
    bodyText,
    bodyHtml: undefined,
    from,
    to,
    cc,
    bcc,
    participants: dedupeParties([from, ...to, ...cc, ...bcc]),
    attachments,
    amounts: [],
    tags: msg.labelIds ?? [],
    status: undefined,
    url: undefined,
    threadId,
    parentId: undefined,
    platformMetadata: {
      platform: "gmail",
      messageId: msg.id ?? "",
      threadId: msg.threadId ?? undefined,
      rfc822MessageId: headers["message-id"],
      labelIds: msg.labelIds ?? [],
      headers,
    },
  }
}
