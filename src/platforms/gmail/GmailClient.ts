import fs from "node:fs"
import { google } from "googleapis"
import { resolveCredentialsPath, resolveTokenReadPathForAccount } from "../../config/CliConfig"
import { verboseLog } from "../../Verbose"

export function loadOAuth(account: string, verbose = false) {
  let credentialsPath = resolveCredentialsPath("gmail")
  let tokenPath = resolveTokenReadPathForAccount(account, "gmail")
  verboseLog(verbose, "gmail auth", { account, credentialsPath, tokenPath })
  let raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
  let creds = raw.installed ?? raw.web
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error(`Bad credentials file at ${credentialsPath}`)
  }
  let oauth = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    (creds.redirect_uris ?? [])[0],
  )
  oauth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf8")))
  return oauth
}

export function gmailClient(account: string, verbose = false) {
  return google.gmail({ version: "v1", auth: loadOAuth(account, verbose) })
}
