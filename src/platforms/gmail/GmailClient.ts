import fs from "node:fs"
import { google } from "googleapis"
import { resolveCredentialsPath, resolveTokenReadPathForAccount } from "../../config/CliConfig"
import { getGmailCredentialsFromEnv, getGmailTokenFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

export function loadOAuth(account: string, verbose = false) {
  let clientId: string, clientSecret: string, redirectUri: string | undefined

  let envCreds = getGmailCredentialsFromEnv()
  if (envCreds) {
    clientId = envCreds.client_id
    clientSecret = envCreds.client_secret
    redirectUri = envCreds.redirect_uri
    verboseLog(verbose, "gmail creds from env", { account })
  } else {
    let credentialsPath = resolveCredentialsPath("gmail")
    verboseLog(verbose, "gmail creds from file", { account, credentialsPath })
    let raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"))
    let creds = raw.installed ?? raw.web
    if (!creds?.client_id || !creds?.client_secret) {
      throw new Error(`Bad credentials file at ${credentialsPath}`)
    }
    clientId = creds.client_id
    clientSecret = creds.client_secret
    redirectUri = (creds.redirect_uris ?? [])[0]
  }

  let oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  let envToken = getGmailTokenFromEnv()
  if (envToken) {
    oauth.setCredentials(envToken)
    verboseLog(verbose, "gmail token from env", { account })
  } else {
    let tokenPath = resolveTokenReadPathForAccount(account, "gmail")
    oauth.setCredentials(JSON.parse(fs.readFileSync(tokenPath, "utf8")))
    verboseLog(verbose, "gmail token from file", { account, tokenPath })
  }

  return oauth
}

export function gmailClient(account: string, verbose = false) {
  return google.gmail({ version: "v1", auth: loadOAuth(account, verbose) })
}
