import fs from "node:fs"
import path from "node:path"
import yargs from "yargs"
import type { Argv } from "yargs"
import { TOKEN_FILE_EXTENSION, resolveAllTokenDirs } from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"
import type { SlackTokenFile } from "./slackClient"

export type SlackAccountInfo = {
  account: string
  team_id: string | undefined
  team_name: string | undefined
  has_bot_token: boolean
  has_user_token: boolean
}

export function listSlackAccounts(): { accounts: SlackAccountInfo[]; dirs: string[] } {
  let out = new Map<string, SlackAccountInfo>()
  let dirs = resolveAllTokenDirs("slack")
  for (let dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(TOKEN_FILE_EXTENSION)) continue
      let account = path.basename(entry.name, TOKEN_FILE_EXTENSION)
      if (out.has(account)) continue
      let info: SlackAccountInfo = {
        account,
        team_id: undefined,
        team_name: undefined,
        has_bot_token: false,
        has_user_token: false,
      }
      try {
        let raw: SlackTokenFile = JSON.parse(fs.readFileSync(path.resolve(dir, entry.name), "utf8"))
        info.team_id = raw.team_id
        info.team_name = raw.team_name
        info.has_bot_token = !!raw.bot_token
        info.has_user_token = !!raw.user_token
      } catch {}
      out.set(account, info)
    }
  }
  return { accounts: Array.from(out.values()).sort((a, b) => a.account.localeCompare(b.account)), dirs }
}

export function configureAccountsCli(cli: Argv): Argv {
  return cli
    .option("format", {
      type: "string",
      choices: ["json", "text"] as const,
      default: "json",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      default: false,
    })
    .strict()
    .help()
}

export async function parseAccountsCli(args: string[], scriptName = "um slack accounts"): Promise<void> {
  let argv = await configureAccountsCli(yargs(args).scriptName(scriptName)).parseAsync()
  let { accounts, dirs } = listSlackAccounts()
  verboseLog(argv.verbose === true, "slack account dirs", dirs)
  if (argv.format === "text") {
    for (let account of accounts) {
      process.stdout.write(`${account.team_name ? `${account.account} (${account.team_name})` : account.account}\n`)
    }
    return
  }
  process.stdout.write(JSON.stringify(accounts, null, 2) + "\n")
}
