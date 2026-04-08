import fs from "node:fs"
import path from "node:path"
import yargs from "yargs"
import type { Argv } from "yargs"
import { TOKEN_FILE_EXTENSION, resolveAllTokenDirs } from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"
import type { ShopifyTokenFile } from "./shopifyClient"

export type ShopifyAccountInfo = {
  account: string
  shop: string | undefined
}

export function listShopifyAccounts(): { accounts: ShopifyAccountInfo[]; dirs: string[] } {
  let out = new Map<string, ShopifyAccountInfo>()
  let dirs = resolveAllTokenDirs("shopify")
  for (let dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(TOKEN_FILE_EXTENSION)) continue
      let account = path.basename(entry.name, TOKEN_FILE_EXTENSION)
      if (out.has(account)) continue
      let info: ShopifyAccountInfo = {
        account,
        shop: undefined,
      }
      try {
        let raw: ShopifyTokenFile = JSON.parse(fs.readFileSync(path.resolve(dir, entry.name), "utf8"))
        info.shop = raw.shop
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

export async function parseAccountsCli(args: string[], scriptName = "unifiedmirror shopify accounts"): Promise<void> {
  let argv = await configureAccountsCli(yargs(args).scriptName(scriptName)).parseAsync()
  let { accounts, dirs } = listShopifyAccounts()
  verboseLog(argv.verbose === true, "shopify account dirs", dirs)
  if (argv.format === "text") {
    for (let account of accounts) {
      process.stdout.write(`${account.shop ? `${account.account} (${account.shop})` : account.account}\n`)
    }
    return
  }
  process.stdout.write(JSON.stringify(accounts, null, 2) + "\n")
}
