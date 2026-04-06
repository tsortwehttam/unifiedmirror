import fs from "node:fs"
import { WebClient } from "@slack/web-api"
import { resolveTokenReadPathForAccount } from "../../config/CliConfig"
import { getSlackTokenFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

export type SlackTokenFile = {
  bot_token: string
  user_token: string | undefined
  team_id: string | undefined
  team_name: string | undefined
}

export type SlackClients = {
  bot: WebClient
  user: WebClient | undefined
  teamId: string | undefined
  teamName: string | undefined
  tokenFile: SlackTokenFile
}

export function loadSlackTokenFile(account: string): SlackTokenFile {
  let envToken = getSlackTokenFromEnv()
  if (envToken) return envToken

  let tokenPath = resolveTokenReadPathForAccount(account, "slack")
  let raw = JSON.parse(fs.readFileSync(tokenPath, "utf8"))
  if (!raw.bot_token) throw new Error(`Token file for "${account}" is missing bot_token`)
  return raw as SlackTokenFile
}

export function slackClients(account: string, verbose = false): SlackClients {
  let tokenFile = loadSlackTokenFile(account)
  verboseLog(verbose, "slack auth", {
    account,
    hasBot: !!tokenFile.bot_token,
    hasUser: !!tokenFile.user_token,
    teamId: tokenFile.team_id,
  })
  return {
    bot: new WebClient(tokenFile.bot_token),
    user: tokenFile.user_token ? new WebClient(tokenFile.user_token) : undefined,
    teamId: tokenFile.team_id,
    teamName: tokenFile.team_name,
    tokenFile,
  }
}

export function slackReadClient(clients: SlackClients): WebClient {
  return clients.user ?? clients.bot
}

function isNotInChannelError(err: unknown): boolean {
  let message = err instanceof Error ? err.message : String(err)
  return message.includes("not_in_channel")
}

export async function postMessageWithJoinFallback(params: {
  clients: SlackClients
  sendClient: WebClient
  channelId: string
  text: string
  threadTs: string | undefined
}) {
  try {
    return await params.sendClient.chat.postMessage({
      channel: params.channelId,
      text: params.text,
      thread_ts: params.threadTs,
    })
  } catch (err) {
    if (params.sendClient !== params.clients.bot || !isNotInChannelError(err)) throw err
    await params.clients.bot.conversations.join({ channel: params.channelId })
    return await params.clients.bot.chat.postMessage({
      channel: params.channelId,
      text: params.text,
      thread_ts: params.threadTs,
    })
  }
}

export async function uploadFilesToChannel(
  client: WebClient,
  channelId: string,
  files: Array<{ filename: string; data: Buffer }>,
  opts: { threadTs: string | undefined; initialComment: string | undefined },
) {
  let out = []
  for (let index = 0; index < files.length; index += 1) {
    let file = files[index]
    let baseRequest = {
      channel_id: channelId,
      file: file.data,
      filename: file.filename,
      title: file.filename,
      initial_comment: index === 0 ? opts.initialComment : undefined,
    }
    let res = opts.threadTs
      ? await client.filesUploadV2({ ...baseRequest, thread_ts: opts.threadTs })
      : await client.filesUploadV2(baseRequest)
    out.push(res)
  }
  return out
}
