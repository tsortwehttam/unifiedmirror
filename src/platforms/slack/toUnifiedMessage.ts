import type { Participant, UnifiedAttachment, UnifiedMessage } from "../../types"

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

export function toUnifiedMessage(
  msg: SlackMessage,
  opts: {
    channelId: string
    channelName: string | undefined
    teamId: string
    userCache: UserCache
    permalink: string | undefined
  },
): UnifiedMessage {
  let from: Participant | undefined
  if (msg.user) {
    from = { address: msg.user, name: opts.userCache.get(msg.user) }
  } else if (msg.bot_id) {
    from = { address: msg.bot_id, name: `bot:${msg.bot_id}` }
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

  return {
    id: `${opts.channelId}:${msg.ts}`,
    platform: "slack",
    timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
    subject: opts.channelName ? `#${opts.channelName.replace(/^#/, "")}` : `channel:${opts.channelId}`,
    bodyText,
    bodyHtml: undefined,
    from,
    to: [{ address: opts.channelId, name: opts.channelName }],
    cc: [],
    bcc: [],
    attachments,
    threadId: msg.thread_ts ?? msg.ts,
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
