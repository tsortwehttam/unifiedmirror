import fs from "node:fs"
import { authenticate } from "@google-cloud/local-auth"
import { google } from "googleapis"
import yargs from "yargs"
import type { Argv } from "yargs"
import {
  DEFAULT_ACCOUNT,
  GMAIL_SCOPES,
  resolveCredentialsPath,
  resolveTokenWriteDir,
  resolveTokenWritePathForAccount,
} from "../../config/CliConfig"
import { getGmailCredentialsFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

async function authForAccount(account: string | undefined, verbose = false): Promise<void> {
  let credentialsPath = resolveCredentialsPath("gmail")
  let tokenDir = resolveTokenWriteDir("gmail")
  fs.mkdirSync(tokenDir, { recursive: true })
  verboseLog(verbose, "gmail auth target", { account: account ?? "(auto)", credentialsPath, tokenDir })
  let auth = await authenticate({ keyfilePath: credentialsPath, scopes: GMAIL_SCOPES })

  if (!account) {
    try {
      let envCreds = getGmailCredentialsFromEnv()
      let detectionId: string, detectionSecret: string
      if (envCreds) {
        detectionId = envCreds.client_id
        detectionSecret = envCreds.client_secret
      } else {
        let raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
        let creds = raw.installed ?? raw.web
        detectionId = creds.client_id
        detectionSecret = creds.client_secret
      }
      let oauth = new google.auth.OAuth2(detectionId, detectionSecret)
      oauth.setCredentials(auth.credentials)
      let gmail = google.gmail({ version: "v1", auth: oauth })
      let profile = await gmail.users.getProfile({ userId: "me" })
      account = profile.data.emailAddress ?? DEFAULT_ACCOUNT
    } catch {
      account = DEFAULT_ACCOUNT
    }
  }

  let tokenPath = resolveTokenWritePathForAccount(account, "gmail")
  fs.writeFileSync(tokenPath, JSON.stringify(auth.credentials, null, 2))
  process.stdout.write(`Saved ${tokenPath}\n`)
}

export function configureAuthCli(cli: Argv): Argv {
  return cli
    .option("account", {
      type: "string",
      describe: "Token account name. Defaults to the Gmail address after auth.",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      default: false,
    })
    .strict()
    .help()
}

export async function parseAuthCli(args: string[], scriptName = "unifiedmirror gmail auth"): Promise<void> {
  let argv = await configureAuthCli(yargs(args).scriptName(scriptName)).parseAsync()
  await authForAccount(typeof argv.account === "string" ? argv.account : undefined, argv.verbose === true)
}
