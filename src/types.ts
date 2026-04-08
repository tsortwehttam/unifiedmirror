export type Platform = "asana" | "gmail" | "messages" | "shopify" | "slack"

export type RecordKind = "comment" | "message" | "order" | "task"

export type UnifiedAttachment = {
  id: string | undefined
  filename: string
  mimeType: string | undefined
  sizeBytes: number | undefined
  url: string | undefined
}

export type UnifiedParty = {
  id: string | undefined
  address: string
  name: string | undefined
  role: string | undefined
}

export type UnifiedAmount = {
  kind: string | undefined
  currency: string
  value: string
}

export type UnifiedTimestamps = {
  created: string | undefined
  updated: string | undefined
  occurred: string | undefined
  sent: string | undefined
  received: string | undefined
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

export type MessagesMetadata = {
  platform: "messages"
  messageRowId: number
  messageGuid: string
  chatRowId: number | undefined
  chatGuid: string | undefined
  chatIdentifier: string | undefined
  service: string | undefined
  handle: string | undefined
  isFromMe: boolean
}

export type AsanaMetadata = {
  platform: "asana"
  taskGid: string
  projectGids: string[]
  sectionGid: string | undefined
  parentTaskGid: string | undefined
  status: string | undefined
  dueOn: string | undefined
  permalink: string | undefined
  customFields: Array<{ gid: string; name: string; displayValue: string | undefined }>
}

export type ShopifyMetadata = {
  platform: "shopify"
  shop: string
  orderId: string
  legacyResourceId: string
  orderNumber: number | undefined
  displayName: string
  customerId: string | undefined
  customerEmail: string | undefined
  financialStatus: string | undefined
  fulfillmentStatus: string | undefined
  cancelReason: string | undefined
  closedAt: string | undefined
  cancelledAt: string | undefined
  confirmed: boolean
  tags: string[]
  lineItems: Array<{
    id: string
    title: string
    sku: string | undefined
    quantity: number
    variantTitle: string | undefined
  }>
}

export type PlatformMetadata =
  | AsanaMetadata
  | GmailMetadata
  | MessagesMetadata
  | ShopifyMetadata
  | SlackMetadata

export type UnifiedRecord = {
  id: string
  kind: RecordKind
  platform: Platform
  account: string
  timestamp: string
  timestamps: UnifiedTimestamps
  subject: string | undefined
  summary: string | undefined
  bodyText: string | undefined
  bodyHtml: string | undefined
  from: UnifiedParty | undefined
  to: UnifiedParty[]
  cc: UnifiedParty[]
  bcc: UnifiedParty[]
  participants: UnifiedParty[]
  attachments: UnifiedAttachment[]
  amounts: UnifiedAmount[]
  tags: string[]
  status: string | undefined
  url: string | undefined
  threadId: string | undefined
  parentId: string | undefined
  platformMetadata: PlatformMetadata
}

export type PullParams = {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}

export type AttachmentSelector = {
  id: string | undefined
  filename: string | undefined
  index: number
}
