import type { gmail_v1 } from "googleapis"
import type { Participant, UnifiedAttachment, UnifiedMessage } from "../../types"
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

function parseParticipant(raw: string): Participant {
  let match = raw.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ""),
      address: match[2].trim(),
    }
  }
  return { address: raw.trim(), name: undefined }
}

function parseParticipants(raw: string | undefined): Participant[] {
  if (!raw) return []
  return raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
    .map(parseParticipant)
}

export function toUnifiedMessage(msg: gmail_v1.Schema$Message): UnifiedMessage {
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

  return {
    id: msg.id ?? "",
    platform: "gmail",
    timestamp,
    subject: headers.subject,
    bodyText: body.text ?? (body.html ? stripHtml(body.html) : undefined),
    bodyHtml: body.html,
    from: headers.from ? parseParticipant(headers.from) : undefined,
    to: parseParticipants(headers.to),
    cc: parseParticipants(headers.cc),
    bcc: parseParticipants(headers.bcc),
    attachments,
    threadId: msg.threadId ?? undefined,
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
