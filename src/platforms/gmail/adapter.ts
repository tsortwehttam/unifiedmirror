import type { PlatformAdapter } from "../../adapters/PlatformAdapter"
import { listGmailMessages, fetchGmailAttachment } from "./GmailSource"
import { parseAccountsCli } from "./accounts"
import { parseAuthCli } from "./auth"

export const gmailAdapter: PlatformAdapter = {
  platform: "gmail",
  kinds: ["message"],
  listRecords(params) {
    return listGmailMessages(params)
  },
  fetchAttachment: fetchGmailAttachment,
  parseAccountsCli,
  parseAuthCli,
  pullOptions: [],
}
