import type { SlackTokenFile } from "../platforms/slack/slackClient"

function env(key: string): string | undefined {
  let value = process.env[key]?.trim()
  return value || undefined
}

function requirePair(a: string, b: string): void {
  let hasA = !!env(a)
  let hasB = !!env(b)
  if (hasA !== hasB) {
    let missing = hasA ? b : a
    throw new Error(`Partial env config: ${missing} must be set when ${hasA ? a : b} is set`)
  }
}

export function getGmailCredentialsFromEnv(): { client_id: string; client_secret: string; redirect_uri?: string } | undefined {
  let clientId = env("UM_GMAIL_CLIENT_ID")
  let clientSecret = env("UM_GMAIL_CLIENT_SECRET")
  if (!clientId && !clientSecret) return undefined
  requirePair("UM_GMAIL_CLIENT_ID", "UM_GMAIL_CLIENT_SECRET")
  return {
    client_id: clientId!,
    client_secret: clientSecret!,
    redirect_uri: env("UM_GMAIL_REDIRECT_URI"),
  }
}

export function getGmailTokenFromEnv(): { access_token: string; refresh_token: string; token_type: string } | undefined {
  let accessToken = env("UM_GMAIL_ACCESS_TOKEN")
  let refreshToken = env("UM_GMAIL_REFRESH_TOKEN")
  if (!accessToken && !refreshToken) return undefined
  requirePair("UM_GMAIL_ACCESS_TOKEN", "UM_GMAIL_REFRESH_TOKEN")
  return {
    access_token: accessToken!,
    refresh_token: refreshToken!,
    token_type: "Bearer",
  }
}

export function getSlackCredentialsFromEnv(): { client_id: string; client_secret: string } | undefined {
  let clientId = env("UM_SLACK_CLIENT_ID")
  let clientSecret = env("UM_SLACK_CLIENT_SECRET")
  if (!clientId && !clientSecret) return undefined
  requirePair("UM_SLACK_CLIENT_ID", "UM_SLACK_CLIENT_SECRET")
  return { client_id: clientId!, client_secret: clientSecret! }
}

export function getSlackTokenFromEnv(): SlackTokenFile | undefined {
  let botToken = env("UM_SLACK_BOT_TOKEN")
  if (!botToken) return undefined
  return {
    bot_token: botToken,
    user_token: env("UM_SLACK_USER_TOKEN"),
    team_id: undefined,
    team_name: undefined,
  }
}
