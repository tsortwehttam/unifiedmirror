import type { AttachmentSelector, UnifiedRecord } from "../../types"
import { verboseLog } from "../../Verbose"
import { collectAttachments } from "./GmailMessageHelpers"
import { gmailClient } from "./GmailClient"
import { resolveGmailQuery } from "./GmailQueryPresets"
import { toUnifiedRecord } from "./toUnifiedRecord"

function parseTime(value: string | undefined): number | undefined {
  if (!value) return undefined
  let time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid time bound "${value}"`)
  return time
}

export function buildGmailQuery(params: {
  preset: string | undefined
  query: string
  since: string | undefined
  until: string | undefined
}): string {
  let base = resolveGmailQuery({
    preset: params.preset,
    query: params.query,
  })
  let terms = base ? [base] : []
  let since = parseTime(params.since)
  let until = parseTime(params.until)
  if (since != null) {
    terms.push(`after:${Math.floor(since / 1000)}`)
  }
  if (until != null) {
    terms.push(`before:${Math.floor(until / 1000) + 1}`)
  }
  return terms.join(" ").trim()
}

export async function listGmailMessages(params: {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
  onBatch: ((rows: UnifiedRecord[]) => Promise<void>) | undefined
}): Promise<UnifiedRecord[]> {
  let client = gmailClient(params.account, params.verbose)
  let since = parseTime(params.since)
  let until = parseTime(params.until)
  let query = buildGmailQuery({
    preset: params.preset,
    query: params.query,
    since: params.since,
    until: params.until,
  })
  let out: UnifiedRecord[] = []
  let pageToken: string | undefined

  while (out.length < params.maxResults) {
    let res = await client.users.messages.list({
      userId: "me",
      q: query || undefined,
      maxResults: Math.min(params.maxResults - out.length, 100),
      pageToken,
    })
    let refs = (res.data.messages ?? []).filter(value => value.id)
    verboseLog(params.verbose, "gmail page", {
      fetched: refs.length,
      pageToken: res.data.nextPageToken ?? null,
      query,
    })

    let batch: UnifiedRecord[] = []
    for (let ref of refs) {
      if (!ref.id || out.length >= params.maxResults) break
      let fetched = await client.users.messages.get({
        userId: "me",
        id: ref.id,
        format: "full",
      })
      let row = toUnifiedRecord(fetched.data, params.account)
      let time = Date.parse(row.timestamp)
      if (since != null && time < since) continue
      if (until != null && time > until) continue
      out.push(row)
      batch.push(row)
    }

    if (batch.length) await params.onBatch?.(batch)

    pageToken = res.data.nextPageToken ?? undefined
    if (!pageToken) break
  }

  return out
}

function selectAttachment(
  selector: AttachmentSelector,
  attachments: ReturnType<typeof collectAttachments>,
): ReturnType<typeof collectAttachments>[number] | undefined {
  if (selector.id) return attachments.find(value => value.attachmentId === selector.id)
  let matches = selector.filename ? attachments.filter(value => value.filename === selector.filename) : attachments
  return matches[selector.index]
}

export async function fetchGmailAttachment(
  row: UnifiedRecord,
  selector: AttachmentSelector,
  account: string,
): Promise<Buffer | undefined> {
  if (row.platformMetadata.platform !== "gmail") return undefined
  let client = gmailClient(account)
  let fetched = await client.users.messages.get({
    userId: "me",
    id: row.platformMetadata.messageId,
    format: "full",
  })
  let attachments = collectAttachments(fetched.data.payload ?? undefined)
  let attachment = selectAttachment(selector, attachments)
  if (!attachment) return undefined
  let raw = attachment.inlineData
  if (!raw && attachment.attachmentId) {
    let extra = await client.users.messages.attachments.get({
      userId: "me",
      messageId: row.platformMetadata.messageId,
      id: attachment.attachmentId,
    })
    raw = extra.data.data ?? undefined
  }
  if (!raw) return undefined
  let normalized = raw.replace(/-/g, "+").replace(/_/g, "/")
  let padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, "base64")
}
