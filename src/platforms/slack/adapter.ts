import type { PlatformAdapter } from "../../adapters/PlatformAdapter"
import { fetchSlackAttachment, listSlackMessages } from "./SlackSource"
import { parseAccountsCli } from "./accounts"
import { parseAuthCli } from "./auth"

export const slackAdapter: PlatformAdapter = {
  platform: "slack",
  kinds: ["message"],
  listRecords(params) {
    return listSlackMessages({
      account: params.account,
      query: params.query,
      preset: params.preset,
      since: params.since,
      until: params.until,
      maxResults: params.maxResults,
      includeThreadReplies: params.options.includeThreadReplies !== false,
      verbose: params.verbose,
    })
  },
  fetchAttachment: fetchSlackAttachment,
  parseAccountsCli,
  parseAuthCli,
  pullOptions: [
    {
      name: "include-thread-replies",
      type: "boolean",
      default: true,
      choices: [],
      describe: "Slack only. Include thread replies for threaded parents returned by channel history.",
    },
  ],
}
