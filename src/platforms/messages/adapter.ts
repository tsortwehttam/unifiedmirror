import fs from "node:fs"
import type { PlatformAdapter } from "../../adapters/PlatformAdapter"
import type { AttachmentSelector, UnifiedRecord } from "../../types"
import { listMessagesMessages } from "./MessagesSource"
import { parseAccountsCli } from "./accounts"

async function fetchMessagesAttachment(
  row: UnifiedRecord,
  selector: AttachmentSelector,
): Promise<Buffer | undefined> {
  let attachment = selector.id
    ? row.attachments.find(value => value.id === selector.id)
    : row.attachments.filter(value => !selector.filename || value.filename === selector.filename)[selector.index]
  if (!attachment?.url) return undefined
  return fs.readFileSync(attachment.url)
}

export const messagesAdapter: PlatformAdapter = {
  platform: "messages",
  kinds: ["message"],
  listRecords(params) {
    return listMessagesMessages(params)
  },
  fetchAttachment: fetchMessagesAttachment,
  parseAccountsCli,
  parseAuthCli: undefined,
  pullOptions: [],
}
