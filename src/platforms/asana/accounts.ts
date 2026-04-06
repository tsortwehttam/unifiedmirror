import fs from "node:fs"
import path from "node:path"
import yargs from "yargs"
import type { Argv } from "yargs"
import { TOKEN_FILE_EXTENSION, resolveAllTokenDirs } from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"
import type { AsanaTokenFile } from "./asanaClient"

export type AsanaAccountInfo = {
  account: string
  workspace_gid: string | undefined
  workspace_name: string | undefined
}

export function listAsanaAccounts(): { accounts: AsanaAccountInfo[]; dirs: string[] } {
  let out = new Map<string, AsanaAccountInfo>()
  let dirs = resolveAllTokenDirs("asana")
  for (let dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(TOKEN_FILE_EXTENSION)) continue
      let account = path.basename(entry.name, TOKEN_FILE_EXTENSION)
      if (out.has(account)) continue
      let info: AsanaAccountInfo = {
        account,
        workspace_gid: undefined,
        workspace_name: undefined,
      }
      try {
        let raw: AsanaTokenFile = JSON.parse(fs.readFileSync(path.resolve(dir, entry.name), "utf8"))
        info.workspace_gid = raw.workspace_gid
        info.workspace_name = raw.workspace_name
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

export async function parseAccountsCli(args: string[], scriptName = "um asana accounts"): Promise<void> {
  let argv = await configureAccountsCli(yargs(args).scriptName(scriptName)).parseAsync()
  let { accounts, dirs } = listAsanaAccounts()
  verboseLog(argv.verbose === true, "asana account dirs", dirs)
  if (argv.format === "text") {
    for (let account of accounts) {
      process.stdout.write(`${account.workspace_name ? `${account.account} (${account.workspace_name})` : account.account}\n`)
    }
    return
  }
  process.stdout.write(JSON.stringify(accounts, null, 2) + "\n")
}
