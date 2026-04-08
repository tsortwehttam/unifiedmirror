import type { WebClient } from "@slack/web-api"
import type { AttachmentSelector, UnifiedRecord } from "../../types"
import { verboseLog } from "../../Verbose"
import { slackClients, slackReadClient } from "./slackClient"
import { toUnifiedRecord, type SlackMessage, type UserCache } from "./toUnifiedRecord"

type SlackHistoryMessage = SlackMessage & {
  reply_count: number | undefined
}

async function resolveChannelIds(
  client: WebClient,
  queries: string[],
  verbose: boolean,
): Promise<Array<{ id: string; name: string }>> {
  let needsResolution = queries.some(query => query.startsWith("#") || !query.match(/^[CDG][A-Z0-9]+$/))
  let byName = new Map<string, string>()
  if (needsResolution) {
    let cursor: string | undefined
    while (true) {
      let res = await client.conversations.list({
        types: "public_channel,private_channel",
        limit: 1000,
        cursor,
      })
      for (let channel of res.channels ?? []) {
        if (channel.id && channel.name) byName.set(channel.name, channel.id)
      }
      cursor = res.response_metadata?.next_cursor || undefined
      if (!cursor) break
    }
    verboseLog(verbose, "slack channels resolved", { count: byName.size })
  }
  let out: Array<{ id: string; name: string }> = []
  for (let query of queries) {
    let name = query.replace(/^#/, "")
    let id = byName.get(name)
    if (id) {
      out.push({ id, name })
      continue
    }
    if (query.match(/^[CDG][A-Z0-9]+$/)) {
      out.push({ id: query, name: query })
      continue
    }
    throw new Error(`Cannot resolve channel "${query}"`)
  }
  return out
}

async function populateUserCache(
  client: WebClient,
  ids: Set<string>,
  cache: UserCache,
  verbose: boolean,
): Promise<void> {
  let pending = Array.from(ids).filter(id => !cache.has(id))
  for (let id of pending) {
    try {
      let res = await client.users.info({ user: id })
      let name = res.user?.profile?.display_name || res.user?.profile?.real_name || res.user?.name || id
      cache.set(id, name)
    } catch {
      cache.set(id, id)
    }
  }
  if (pending.length) verboseLog(verbose, "slack users resolved", { count: pending.length })
}

function collectUserIds(messages: SlackMessage[]): Set<string> {
  let ids = new Set<string>()
  for (let message of messages) {
    if (message.user) ids.add(message.user)
  }
  return ids
}

function shouldFetchReplies(message: SlackHistoryMessage): boolean {
  return !!message.ts && (message.reply_count ?? 0) > 0
}

function toThreadReplies(messages: SlackMessage[], threadTs: string): SlackMessage[] {
  return messages.filter(message => message.ts && message.ts !== threadTs)
}

function toSlackBound(value: string | undefined): string | undefined {
  if (!value) return undefined
  let time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid time bound "${value}"`)
  return String(time / 1000)
}

async function listThreadReplies(params: {
  client: WebClient
  channelId: string
  threadTs: string
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}): Promise<SlackMessage[]> {
  let out: SlackMessage[] = []
  let cursor: string | undefined
  let oldest = toSlackBound(params.since)
  let latest = toSlackBound(params.until)

  while (out.length < params.maxResults) {
    let res = await params.client.conversations.replies({
      channel: params.channelId,
      ts: params.threadTs,
      limit: Math.min(params.maxResults + 1, 200),
      oldest,
      latest,
      inclusive: true,
      cursor,
    })
    let replies = toThreadReplies((res.messages ?? []) as SlackMessage[], params.threadTs)
    out.push(...replies.slice(0, params.maxResults - out.length))
    cursor = res.response_metadata?.next_cursor || undefined
    if (!cursor || !res.has_more) break
  }

  verboseLog(params.verbose, "slack thread replies", {
    channelId: params.channelId,
    threadTs: params.threadTs,
    fetched: out.length,
  })
  return out
}

export async function listSlackMessages(params: {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  includeThreadReplies: boolean
  verbose: boolean
  onBatch: ((rows: UnifiedRecord[]) => Promise<void>) | undefined
}): Promise<UnifiedRecord[]> {
  let clients = slackClients(params.account, params.verbose)
  let reader = slackReadClient(clients)
  let queries = params.query
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
  if (queries.length === 0) return []

  let channels = await resolveChannelIds(reader, queries, params.verbose)
  let userCache: UserCache = new Map()
  let out: UnifiedRecord[] = []

  for (let channel of channels) {
    if (out.length >= params.maxResults) break
    let cursor: string | undefined
    let oldest = toSlackBound(params.since)
    let latest = toSlackBound(params.until)

    while (out.length < params.maxResults) {
      let res = await reader.conversations.history({
        channel: channel.id,
        limit: Math.min(params.maxResults - out.length, 200),
        oldest,
        latest,
        inclusive: true,
        cursor,
      })
      let messages = res.messages ?? []
      let userIds = collectUserIds(messages as SlackMessage[])
      await populateUserCache(reader, userIds, userCache, params.verbose)

      let batch: UnifiedRecord[] = []
      for (let message of messages) {
        if (out.length >= params.maxResults) break
        if (!message.ts) continue
        if (message.subtype === "channel_join" || message.subtype === "channel_leave") continue
        let normalized = message as SlackHistoryMessage
        let row = toUnifiedRecord(normalized, {
          account: params.account,
          channelId: channel.id,
          channelName: channel.name,
          teamId: clients.teamId ?? "",
          userCache,
          permalink: undefined,
        })
        out.push(row)
        batch.push(row)

        if (out.length >= params.maxResults || !params.includeThreadReplies || !shouldFetchReplies(normalized)) continue
        let replies = await listThreadReplies({
          client: reader,
          channelId: channel.id,
          threadTs: normalized.ts,
          since: params.since,
          until: params.until,
          maxResults: params.maxResults - out.length,
          verbose: params.verbose,
        })
        await populateUserCache(reader, collectUserIds(replies), userCache, params.verbose)
        for (let reply of replies) {
          if (out.length >= params.maxResults) break
          if (!reply.ts) continue
          let row = toUnifiedRecord(reply, {
            account: params.account,
            channelId: channel.id,
            channelName: channel.name,
            teamId: clients.teamId ?? "",
            userCache,
            permalink: undefined,
          })
          out.push(row)
          batch.push(row)
        }
      }

      if (batch.length) await params.onBatch?.(batch)

      cursor = res.response_metadata?.next_cursor || undefined
      if (!cursor || !res.has_more) break
    }
  }

  return out
}

export async function fetchSlackAttachment(
  row: UnifiedRecord,
  selector: AttachmentSelector,
  account: string,
): Promise<Buffer | undefined> {
  if (row.platformMetadata.platform !== "slack") return undefined
  let attachment = selector.id
    ? row.attachments.find(value => value.id === selector.id)
    : row.attachments.filter(value => !selector.filename || value.filename === selector.filename)[selector.index]
  if (!attachment?.url) return undefined
  let clients = slackClients(account)
  let token = clients.tokenFile.user_token ?? clients.tokenFile.bot_token
  let res = await fetch(attachment.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Slack attachment "${attachment.filename}": ${res.status} ${res.statusText}`,
    )
  }
  return Buffer.from(await res.arrayBuffer())
}

export { collectUserIds, shouldFetchReplies, toThreadReplies }
