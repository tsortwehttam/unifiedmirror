export type Platform = "gmail" | "slack"

export type UnifiedAttachment = {
  filename: string
  mimeType: string | undefined
  sizeBytes: number | undefined
  url: string | undefined
}

export type Participant = {
  address: string
  name: string | undefined
}

export type GmailMetadata = {
  platform: "gmail"
  messageId: string
  threadId: string | undefined
  rfc822MessageId: string | undefined
  labelIds: string[]
  headers: Record<string, string>
}

export type SlackMetadata = {
  platform: "slack"
  teamId: string
  channelId: string
  channelName: string | undefined
  ts: string
  threadTs: string | undefined
  permalink: string | undefined
}

export type PlatformMetadata = GmailMetadata | SlackMetadata

export type UnifiedMessage = {
  id: string
  platform: Platform
  timestamp: string
  subject: string | undefined
  bodyText: string | undefined
  bodyHtml: string | undefined
  from: Participant | undefined
  to: Participant[]
  cc: Participant[]
  bcc: Participant[]
  attachments: UnifiedAttachment[]
  threadId: string | undefined
  platformMetadata: PlatformMetadata
}

export type PullParams = {
  account: string
  query: string
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}
