import type { UnifiedAttachment, UnifiedParty, UnifiedRecord } from "../../types"
import { buildRecordId, dedupeParties, trimSummary } from "../PlatformUtils"

export type SlackMessage = {
  ts: string
  user: string | undefined
  text: string | undefined
  thread_ts: string | undefined
  team: string | undefined
  permalink: string | undefined
  bot_id: string | undefined
  subtype: string | undefined
  files: SlackFile[] | undefined
  attachments: SlackAttachment[] | undefined
}

type SlackFile = {
  id: string
  name: string | undefined
  title: string | undefined
  mimetype: string | undefined
  size: number | undefined
  url_private: string | undefined
  url_private_download: string | undefined
  permalink: string | undefined
}

type SlackAttachment = {
  title: string | undefined
  text: string | undefined
  fallback: string | undefined
}

export type UserCache = Map<string, string>

export function toUnifiedRecord(
  msg: SlackMessage,
  opts: {
    account: string
    channelId: string
    channelName: string | undefined
    teamId: string
    userCache: UserCache
    permalink: string | undefined
  },
): UnifiedRecord {
  let from: UnifiedParty | undefined
  if (msg.user) {
    from = { id: msg.user, address: msg.user, name: opts.userCache.get(msg.user), role: "sender" }
  } else if (msg.bot_id) {
    from = { id: msg.bot_id, address: msg.bot_id, name: `bot:${msg.bot_id}`, role: "sender" }
  }

  let bodyText = msg.text ?? undefined
  if (msg.attachments?.length) {
    let extra = msg.attachments
      .map(item => item.text || item.fallback || item.title || "")
      .filter(Boolean)
      .join("\n---\n")
    if (extra) bodyText = bodyText ? `${bodyText}\n---\n${extra}` : extra
  }

  let attachments: UnifiedAttachment[] = (msg.files ?? []).map(file => ({
    id: file.id,
    filename: file.name || file.title || file.id,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    url: file.url_private_download || file.url_private || file.permalink,
  }))

  let to: UnifiedParty[] = [{ id: opts.channelId, address: opts.channelId, name: opts.channelName, role: "channel" }]
  let timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString()
  let threadId = buildRecordId("slack", opts.account, "message", "thread", opts.channelId, msg.thread_ts ?? msg.ts)

  return {
    id: buildRecordId("slack", opts.account, "message", opts.channelId, msg.ts),
    kind: "message",
    platform: "slack",
    account: opts.account,
    timestamp,
    timestamps: {
      created: timestamp,
      updated: undefined,
      occurred: timestamp,
      sent: timestamp,
      received: timestamp,
    },
    subject: opts.channelName ? `#${opts.channelName.replace(/^#/, "")}` : `channel:${opts.channelId}`,
    summary: trimSummary(bodyText),
    bodyText,
    bodyHtml: undefined,
    from,
    to,
    cc: [],
    bcc: [],
    participants: dedupeParties([from, ...to]),
    attachments,
    amounts: [],
    tags: [],
    status: undefined,
    url: opts.permalink ?? msg.permalink,
    threadId,
    parentId: msg.thread_ts && msg.thread_ts !== msg.ts
      ? buildRecordId("slack", opts.account, "message", opts.channelId, msg.thread_ts)
      : undefined,
    platformMetadata: {
      platform: "slack",
      teamId: opts.teamId,
      channelId: opts.channelId,
      channelName: opts.channelName,
      ts: msg.ts,
      threadTs: msg.thread_ts,
      permalink: opts.permalink ?? msg.permalink,
    },
  }
}
