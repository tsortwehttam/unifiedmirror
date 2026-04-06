import fs from "node:fs"
import path from "node:path"
import yargs from "yargs"
import type { Argv } from "yargs"
import { TOKEN_FILE_EXTENSION, resolveAllTokenDirs } from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"

export function listGmailAccounts(): { accounts: string[]; dirs: string[] } {
  let accounts = new Set<string>()
  let dirs = resolveAllTokenDirs("gmail")
  for (let dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(TOKEN_FILE_EXTENSION)) continue
      accounts.add(path.basename(entry.name, TOKEN_FILE_EXTENSION))
    }
  }
  return { accounts: Array.from(accounts).sort(), dirs }
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

export async function parseAccountsCli(args: string[], scriptName = "um gmail accounts"): Promise<void> {
  let argv = await configureAccountsCli(yargs(args).scriptName(scriptName)).parseAsync()
  let { accounts, dirs } = listGmailAccounts()
  verboseLog(argv.verbose === true, "gmail account dirs", dirs)
  if (argv.format === "text") {
    for (let account of accounts) process.stdout.write(`${account}\n`)
    return
  }
  process.stdout.write(JSON.stringify(accounts, null, 2) + "\n")
}
