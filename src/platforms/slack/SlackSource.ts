import type { WebClient } from "@slack/web-api"
import type { UnifiedMessage } from "../../types"
import { verboseLog } from "../../Verbose"
import { slackClients, slackReadClient } from "./slackClient"
import { toUnifiedMessage, type SlackMessage, type UserCache } from "./toUnifiedMessage"

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

function toSlackBound(value: string | undefined): string | undefined {
  if (!value) return undefined
  let time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid time bound "${value}"`)
  return String(time / 1000)
}

export async function listSlackMessages(params: {
  account: string
  query: string
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}): Promise<UnifiedMessage[]> {
  let clients = slackClients(params.account, params.verbose)
  let reader = slackReadClient(clients)
  let queries = params.query
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
  if (queries.length === 0) return []

  let channels = await resolveChannelIds(reader, queries, params.verbose)
  let userCache: UserCache = new Map()
  let out: UnifiedMessage[] = []

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
      let userIds = new Set<string>()
      for (let message of messages) {
        if (message.user) userIds.add(message.user)
      }
      await populateUserCache(reader, userIds, userCache, params.verbose)

      for (let message of messages) {
        if (out.length >= params.maxResults) break
        if (!message.ts) continue
        if (message.subtype === "channel_join" || message.subtype === "channel_leave") continue
        out.push(
          toUnifiedMessage(message as SlackMessage, {
            channelId: channel.id,
            channelName: channel.name,
            teamId: clients.teamId ?? "",
            userCache,
            permalink: undefined,
          }),
        )
      }

      cursor = res.response_metadata?.next_cursor || undefined
      if (!cursor || !res.has_more) break
    }
  }

  return out
}
