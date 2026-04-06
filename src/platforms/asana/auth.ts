import fs from "node:fs"
import yargs from "yargs"
import type { Argv } from "yargs"
import {
  DEFAULT_ACCOUNT,
  resolveTokenWriteDir,
  resolveTokenWritePathForAccount,
} from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"
import { asanaFetch, type AsanaTokenFile } from "./asanaClient"

export function configureAuthCli(cli: Argv): Argv {
  return cli
    .option("account", {
      type: "string",
      default: DEFAULT_ACCOUNT,
    })
    .option("token", {
      type: "string",
      describe: "Asana Personal Access Token",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      default: false,
    })
    .strict()
    .help()
}

export async function parseAuthCli(args: string[], scriptName = "um asana auth"): Promise<void> {
  let argv = await configureAuthCli(yargs(args).scriptName(scriptName)).parseAsync()
  let account = typeof argv.account === "string" ? argv.account : DEFAULT_ACCOUNT
  let verbose = argv.verbose === true

  let pat = typeof argv.token === "string" ? argv.token : undefined
  if (!pat) {
    let chunks: Buffer[] = []
    for await (let chunk of process.stdin) chunks.push(chunk as Buffer)
    pat = Buffer.concat(chunks).toString("utf8").trim()
  }
  if (!pat) throw new Error("No token provided. Pass --token or pipe to stdin.")

  let me = await asanaFetch(pat, "/users/me", undefined, verbose)
  let user = me.data
  let workspaces: Array<{ gid: string; name: string }> = user.workspaces ?? []
  let workspace = workspaces[0]

  let tokenDir = resolveTokenWriteDir("asana")
  let tokenPath = resolveTokenWritePathForAccount(account, "asana")
  fs.mkdirSync(tokenDir, { recursive: true })
  let body: AsanaTokenFile = {
    pat,
    workspace_gid: workspace?.gid,
    workspace_name: workspace?.name,
  }
  fs.writeFileSync(tokenPath, JSON.stringify(body, null, 2) + "\n")
  verboseLog(verbose, "saved asana token", { account, tokenPath, workspaceGid: workspace?.gid })
  process.stdout.write(`Authenticated as "${user.name}" (${user.email})\n`)
  if (workspace) process.stdout.write(`Default workspace: "${workspace.name}" (${workspace.gid})\n`)
  process.stdout.write(`Saved ${tokenPath}\n`)
}
