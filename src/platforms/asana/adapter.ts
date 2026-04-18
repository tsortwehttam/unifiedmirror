import type { PlatformAdapter } from "../../adapters/PlatformAdapter"
import { fetchAsanaAttachment, listAsanaMessages } from "./AsanaSource"
import { parseAccountsCli } from "./accounts"
import { parseAuthCli } from "./auth"

export const asanaAdapter: PlatformAdapter = {
  platform: "asana",
  kinds: ["task", "comment"],
  listRecords(params) {
    return listAsanaMessages({
      account: params.account,
      query: params.query,
      preset: params.preset,
      since: params.since,
      until: params.until,
      maxResults: params.maxResults,
      currentState: params.options.currentState === true,
      includeSubtasks: params.options.includeSubtasks !== false,
      includeComments: params.options.includeComments !== false,
      verbose: params.verbose,
      onBatch: params.onBatch,
    })
  },
  fetchAttachment: fetchAsanaAttachment,
  parseAccountsCli,
  parseAuthCli,
  pullOptions: [
    {
      name: "include-subtasks",
      type: "boolean",
      default: true,
      choices: [],
      describe: "Asana only. Include subtasks for each task.",
    },
    {
      name: "include-comments",
      type: "boolean",
      default: true,
      choices: [],
      describe: "Asana only. Include comments for each task.",
    },
    {
      name: "current-state",
      type: "boolean",
      default: false,
      choices: [],
      describe: "Asana only. Re-read each project's full current task/comment state and ignore --since, --until, and --max-results.",
    },
  ],
}
