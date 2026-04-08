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
