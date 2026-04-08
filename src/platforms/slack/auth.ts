import crypto from "node:crypto"
import { exec } from "node:child_process"
import fs from "node:fs"
import readline from "node:readline/promises"
import { URL } from "node:url"
import { WebClient } from "@slack/web-api"
import yargs from "yargs"
import type { Argv } from "yargs"
import {
  DEFAULT_ACCOUNT,
  resolveCredentialsPath,
  resolveTokenWriteDir,
  resolveTokenWritePathForAccount,
} from "../../config/CliConfig"
import { getSlackCredentialsFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"
import type { SlackTokenFile } from "./slackClient"

const SLACK_OAUTH_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize"
const OAUTH_REDIRECT_URI = "https://tsortwehttam.github.io/unifiedmirror/oauth"
const BOT_SCOPES = [
  "channels:history",
  "channels:join",
  "channels:read",
  "groups:history",
  "groups:read",
  "im:history",
  "mpim:history",
  "users:read",
  "chat:write",
].join(",")
const USER_SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "im:history",
  "mpim:history",
  "users:read",
  "search:read",
  "chat:write",
].join(",")

function openBrowser(url: string): void {
  let cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  exec(`${cmd} ${JSON.stringify(url)}`, () => {})
}

function parseCode(input: string): string | undefined {
  let trimmed = input.trim()
  if (/^\d+\.\d+\.\w+$/.test(trimmed)) return trimmed
  try {
    return new URL(trimmed).searchParams.get("code") ?? undefined
  } catch {
    return undefined
  }
}

async function authBot(account: string, token: string, verbose = false): Promise<void> {
  let client = new WebClient(token)
  let test = await client.auth.test()
  if (!test.ok) throw new Error(`auth.test failed: ${test.error}`)
  let tokenDir = resolveTokenWriteDir("slack")
  let tokenPath = resolveTokenWritePathForAccount(account, "slack")
  fs.mkdirSync(tokenDir, { recursive: true })
  let body: SlackTokenFile = {
    bot_token: token,
    user_token: undefined,
    team_id: test.team_id,
    team_name: test.team,
  }
  fs.writeFileSync(tokenPath, JSON.stringify(body, null, 2) + "\n")
  verboseLog(verbose, "saved slack token", { account, tokenPath, teamId: test.team_id })
  process.stdout.write(`Authenticated as "${test.user}" in workspace "${test.team}" (${test.team_id})\n`)
  process.stdout.write(`Saved ${tokenPath}\n`)
}

async function authOAuth(account: string, verbose = false, externalRl?: readline.Interface): Promise<void> {
  let clientId: string, clientSecret: string
  let envCreds = getSlackCredentialsFromEnv()
  if (envCreds) {
    clientId = envCreds.client_id
    clientSecret = envCreds.client_secret
  } else {
    let credentialsPath = resolveCredentialsPath("slack")
    let creds = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
    clientId = creds.client_id
    clientSecret = creds.client_secret
    if (!clientId || !clientSecret) throw new Error(`${credentialsPath} must contain client_id and client_secret`)
  }

  let state = crypto.randomBytes(16).toString("hex")
  let authUrl =
    `${SLACK_OAUTH_AUTHORIZE_URL}?client_id=${clientId}&scope=${BOT_SCOPES}` +
    `&user_scope=${USER_SCOPES}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}` +
    `&state=${state}`

  let ownRl = !externalRl
  let rl = externalRl ?? readline.createInterface({ input: process.stdin, output: process.stdout })
  process.stdout.write(`Add this Redirect URL to your Slack app:\n${OAUTH_REDIRECT_URI}\n`)
  await rl.question("Press Enter when done...")
  openBrowser(authUrl)
  process.stdout.write(`Opening browser... if needed, visit:\n${authUrl}\n`)
  let input = await rl.question("Paste URL or code: ")
  if (ownRl) rl.close()

  let code = parseCode(input)
  if (!code) throw new Error("Could not find an authorization code in that input")
  try {
    let received = new URL(input.trim()).searchParams.get("state")
    if (received && received !== state) throw new Error("OAuth state mismatch")
  } catch (err) {
    if (err instanceof Error && err.message === "OAuth state mismatch") throw err
  }

  let client = new WebClient()
  let response = await client.oauth.v2.access({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
  })
  if (!response.ok) throw new Error(`oauth.v2.access failed: ${response.error}`)
  let tokenDir = resolveTokenWriteDir("slack")
  let tokenPath = resolveTokenWritePathForAccount(account, "slack")
  fs.mkdirSync(tokenDir, { recursive: true })
  let body: SlackTokenFile = {
    bot_token: response.access_token ?? "",
    user_token: response.authed_user?.access_token,
    team_id: response.team?.id,
    team_name: response.team?.name,
  }
  if (!body.bot_token) throw new Error("No bot token received from OAuth exchange")
  fs.writeFileSync(tokenPath, JSON.stringify(body, null, 2) + "\n")
  verboseLog(verbose, "saved slack oauth", { account, tokenPath, teamId: body.team_id, hasUser: !!body.user_token })
  process.stdout.write(`Authenticated workspace "${body.team_name}" (${body.team_id})\n`)
  process.stdout.write(`Bot token: yes | User token: ${body.user_token ? "yes" : "no"}\n`)
  process.stdout.write(`Saved ${tokenPath}\n`)
}

export function configureAuthCli(cli: Argv): Argv {
  return cli
    .option("account", {
      type: "string",
      default: DEFAULT_ACCOUNT,
    })
    .option("mode", {
      type: "string",
      choices: ["bot", "oauth"] as const,
      default: "bot",
    })
    .option("token", {
      type: "string",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      default: false,
    })
    .strict()
    .help()
}

export async function parseAuthCli(args: string[], scriptName = "unifiedmirror slack auth"): Promise<void> {
  let argv = await configureAuthCli(yargs(args).scriptName(scriptName)).parseAsync()
  let account = typeof argv.account === "string" ? argv.account : DEFAULT_ACCOUNT
  let verbose = argv.verbose === true
  if (argv.mode === "oauth") {
    await authOAuth(account, verbose)
    return
  }
  let token = typeof argv.token === "string" ? argv.token : undefined
  if (!token) {
    let chunks: Buffer[] = []
    for await (let chunk of process.stdin) chunks.push(chunk as Buffer)
    token = Buffer.concat(chunks).toString("utf8").trim()
  }
  if (!token) throw new Error("No token provided. Pass --token or pipe to stdin.")
  await authBot(account, token, verbose)
}
