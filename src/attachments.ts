import fs from "node:fs"
import type { AttachmentSelector, UnifiedMessage } from "./types"
import { fetchAsanaAttachment } from "./platforms/asana/AsanaSource"
import { fetchGmailAttachment } from "./platforms/gmail/GmailSource"
import { fetchSlackAttachment } from "./platforms/slack/SlackSource"

export function selectorFromAttachment(params: {
  id: string | undefined
  filename: string | undefined
  index: number | undefined
}): AttachmentSelector {
  return {
    id: params.id,
    filename: params.filename,
    index: params.index ?? 0,
  }
}

export async function fetchAttachment(
  msg: UnifiedMessage,
  selector: AttachmentSelector,
  account: string,
): Promise<Buffer | undefined> {
  if (msg.platform === "gmail") return fetchGmailAttachment(msg, selector, account)
  if (msg.platform === "slack") return fetchSlackAttachment(msg, selector, account)
  if (msg.platform === "asana") return fetchAsanaAttachment(msg, selector, account)
  if (msg.platform === "messages") {
    let attachment = selector.id
      ? msg.attachments.find(value => value.id === selector.id)
      : msg.attachments.filter(value => !selector.filename || value.filename === selector.filename)[selector.index]
    if (!attachment?.url) return undefined
    return fs.readFileSync(attachment.url)
  }
  return undefined
}
