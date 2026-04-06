import fs from "node:fs"
import path from "node:path"
import { postMessageWithJoinFallback, slackClients, slackReadClient, uploadFilesToChannel } from "./slackClient"

async function resolveChannelId(input: string, account: string, verbose: boolean): Promise<string> {
  if (!input.startsWith("#")) return input
  let clients = slackClients(account, verbose)
  let reader = slackReadClient(clients)
  let res = await reader.conversations.list({
    types: "public_channel,private_channel",
    limit: 1000,
  })
  let match = (res.channels ?? []).find(channel => channel.name === input.replace(/^#/, ""))
  if (!match?.id) throw new Error(`Channel "${input}" not found`)
  return match.id
}

export async function sendSlackMessage(params: {
  account: string
  channel: string
  text: string
  threadTs: string | undefined
  attach: string[]
  asUser: boolean
  verbose: boolean
}) {
  let clients = slackClients(params.account, params.verbose)
  let sendClient = params.asUser && clients.user ? clients.user : clients.bot
  let channelId = await resolveChannelId(params.channel, params.account, params.verbose)

  let messageResult: { ok?: boolean; ts?: string; channel?: string } | null = null
  if (params.text) {
    let res = await postMessageWithJoinFallback({
      clients,
      sendClient,
      channelId,
      text: params.text,
      threadTs: params.threadTs,
    })
    messageResult = { ok: res.ok, ts: res.ts, channel: res.channel }
  }

  if (params.attach.length > 0) {
    let files = params.attach.map(filePath => ({
      filename: path.basename(filePath),
      data: fs.readFileSync(filePath),
    }))
    await uploadFilesToChannel(sendClient, channelId, files, {
      threadTs: params.threadTs ?? messageResult?.ts,
      initialComment: messageResult ? undefined : params.text || undefined,
    })
  }

  return {
    ok: messageResult?.ok ?? true,
    ts: messageResult?.ts,
    channel: messageResult?.channel ?? channelId,
    filesUploaded: params.attach.length,
  }
}
