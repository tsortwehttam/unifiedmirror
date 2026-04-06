import yargs, { type Argv } from "yargs"
import { hideBin } from "yargs/helpers"
import { DEFAULT_ACCOUNT } from "../config/CliConfig"
import { appendJsonl, resolveJsonlDest } from "../io/JsonlUtils"
import { syncJsonl, type MergeBy, type ShardMode, type SortBy } from "../io/SyncUtils"
import { parseAccountsCli as parseGmailAccountsCli } from "../platforms/gmail/accounts"
import { parseAuthCli as parseGmailAuthCli } from "../platforms/gmail/auth"
import { sendGmailMessage } from "../platforms/gmail/GmailSend"
import { listGmailMessages } from "../platforms/gmail/GmailSource"
import { GMAIL_QUERY_PRESETS } from "../platforms/gmail/GmailQueryPresets"
import { parseAccountsCli as parseMessagesAccountsCli } from "../platforms/messages/accounts"
import { listMessagesMessages } from "../platforms/messages/MessagesSource"
import { parseAccountsCli as parseSlackAccountsCli } from "../platforms/slack/accounts"
import { parseAuthCli as parseSlackAuthCli } from "../platforms/slack/auth"
import { sendSlackMessage } from "../platforms/slack/SlackSend"
import { listSlackMessages } from "../platforms/slack/SlackSource"
import type { Platform, UnifiedMessage } from "../types"

function toList(value: unknown): string[] {
  if (value == null) return []
  let raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap(item => String(item).split(","))
    .map(item => item.trim())
    .filter(Boolean)
}

function requireBody(body: string | undefined, html: string | undefined): string {
  return body ?? html ?? ""
}

function toStringArg(value: unknown): string {
  return String(value)
}

function toMaybeStringArg(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function toNumberArg(value: unknown): number {
  return Number(value)
}

function toBooleanArg(value: unknown): boolean {
  return Boolean(value)
}

function toPlatformArg(value: unknown): Platform {
  let platform = toStringArg(value)
  if (platform === "gmail" || platform === "slack" || platform === "messages") return platform
  throw new Error(`Unknown platform "${platform}"`)
}

function addPullOptions<T>(cli: Argv<T>): Argv<T> {
  return cli
    .option("platform", {
      type: "string",
      choices: ["gmail", "slack", "messages"] as const,
      demandOption: true,
    })
    .option("account", {
      type: "string",
      default: DEFAULT_ACCOUNT,
    })
    .option("query", {
      type: "string",
      default: "",
      describe: "Platform-specific filter. For Slack, comma-separated channel names or IDs. For Messages, comma-separated chat identifiers, chat GUIDs, or handles.",
    })
    .option("preset", {
      type: "string",
      choices: Object.keys(GMAIL_QUERY_PRESETS),
      describe: "Gmail-only query preset",
    })
    .option("since", {
      type: "string",
    })
    .option("until", {
      type: "string",
    })
    .option("max-results", {
      type: "number",
      default: 100,
    })
    .option("include-thread-replies", {
      type: "boolean",
      default: true,
      describe: "Slack only. Include thread replies for threaded parents returned by channel history.",
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      default: false,
    })
}

async function pullRows(params: {
  platform: Platform
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  includeThreadReplies: boolean
  verbose: boolean
}): Promise<UnifiedMessage[]> {
  if (params.platform === "gmail") {
    return listGmailMessages({
      account: params.account,
      query: params.query,
      preset: params.preset,
      since: params.since,
      until: params.until,
      maxResults: params.maxResults,
      verbose: params.verbose,
    })
  }
  if (params.platform === "slack") {
    return listSlackMessages({
      account: params.account,
      query: params.query,
      preset: params.preset,
      since: params.since,
      until: params.until,
      maxResults: params.maxResults,
      includeThreadReplies: params.includeThreadReplies,
      verbose: params.verbose,
    })
  }
  return listMessagesMessages({
    account: params.account,
    query: params.query,
    preset: params.preset,
    since: params.since,
    until: params.until,
    maxResults: params.maxResults,
    verbose: params.verbose,
  })
}

await yargs(hideBin(process.argv))
  .scriptName("um")
  .command(
    "pull",
    "Pull unified messages from Gmail, Slack, or Messages and append them to JSONL",
    cli =>
      addPullOptions(cli)
        .option("dest", {
          type: "string",
          describe: "Output directory or .jsonl path",
        }),
    async argv => {
      let rows = await pullRows({
        platform: toPlatformArg(argv.platform),
        account: toStringArg(argv.account),
        query: toStringArg(argv.query),
        preset: toMaybeStringArg(argv.preset),
        since: toMaybeStringArg(argv.since),
        until: toMaybeStringArg(argv.until),
        maxResults: toNumberArg(argv.maxResults),
        includeThreadReplies: toBooleanArg(argv.includeThreadReplies),
        verbose: toBooleanArg(argv.verbose),
      })

      let dest = resolveJsonlDest(toMaybeStringArg(argv.dest))
      appendJsonl(dest, rows)
      process.stdout.write(`${JSON.stringify({ wrote: rows.length, dest })}\n`)
    },
  )
  .command(
    "sync",
    "Pull unified messages and merge them into deterministic JSONL shards",
    cli =>
      addPullOptions(cli)
        .option("dest-root", {
          type: "string",
          demandOption: true,
          describe: "Output directory root. With --shard month, files land in <dest-root>/<YYYY-MM>/messages.jsonl.",
        })
        .option("shard", {
          type: "string",
          choices: ["month", "none"] as const,
          default: "none",
        })
        .option("merge-by", {
          type: "string",
          choices: ["id"] as const,
          default: "id",
        })
        .option("sort-by", {
          type: "string",
          choices: ["timestamp", "none"] as const,
          default: "timestamp",
        }),
    async argv => {
      let rows = await pullRows({
        platform: toPlatformArg(argv.platform),
        account: toStringArg(argv.account),
        query: toStringArg(argv.query),
        preset: toMaybeStringArg(argv.preset),
        since: toMaybeStringArg(argv.since),
        until: toMaybeStringArg(argv.until),
        maxResults: toNumberArg(argv.maxResults),
        includeThreadReplies: toBooleanArg(argv.includeThreadReplies),
        verbose: toBooleanArg(argv.verbose),
      })

      let writes = syncJsonl({
        rows,
        destRoot: toStringArg(argv.destRoot),
        platform: toPlatformArg(argv.platform),
        account: toStringArg(argv.account),
        query: toStringArg(argv.query),
        preset: toMaybeStringArg(argv.preset),
        since: toMaybeStringArg(argv.since),
        until: toMaybeStringArg(argv.until),
        shard: toStringArg(argv.shard) as ShardMode,
        mergeBy: toStringArg(argv.mergeBy) as MergeBy,
        sortBy: toStringArg(argv.sortBy) as SortBy,
        includeThreadReplies: toPlatformArg(argv.platform) === "slack" ? toBooleanArg(argv.includeThreadReplies) : undefined,
      })

      process.stdout.write(`${JSON.stringify({ wrote: rows.length, shards: writes })}\n`)
    },
  )
  .command(
    "send",
    "Send a Gmail or Slack message",
    cli =>
      cli
        .option("platform", {
          type: "string",
          choices: ["gmail", "slack"] as const,
          demandOption: true,
        })
        .option("account", {
          type: "string",
          default: DEFAULT_ACCOUNT,
        })
        .option("from", {
          type: "string",
        })
        .option("to", {
          type: "array",
          string: true,
          default: [],
        })
        .option("cc", {
          type: "array",
          string: true,
          default: [],
        })
        .option("bcc", {
          type: "array",
          string: true,
          default: [],
        })
        .option("subject", {
          type: "string",
          default: "",
        })
        .option("body", {
          type: "string",
        })
        .option("html", {
          type: "string",
        })
        .option("reply-to", {
          type: "string",
        })
        .option("in-reply-to", {
          type: "string",
        })
        .option("references", {
          type: "string",
        })
        .option("message-id", {
          type: "string",
        })
        .option("thread-id", {
          type: "string",
          describe: "Gmail thread id or Slack thread ts",
        })
        .option("attach", {
          type: "array",
          string: true,
          default: [],
        })
        .option("as-user", {
          type: "boolean",
          default: true,
          describe: "Slack only. Prefer the user token when available.",
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          default: false,
        }),
    async argv => {
      let to = toList(argv.to)
      let cc = toList(argv.cc)
      let bcc = toList(argv.bcc)
      let attach = toList(argv.attach)

      let result =
        argv.platform === "gmail"
          ? await sendGmailMessage({
              account: argv.account,
              from: argv.from,
              to,
              cc,
              bcc,
              replyTo: argv.replyTo,
              inReplyTo: argv.inReplyTo,
              references: argv.references,
              messageId: argv.messageId,
              subject: argv.subject,
              body: requireBody(argv.body, argv.html),
              attach,
              threadId: argv.threadId,
              verbose: argv.verbose,
            })
          : await sendSlackMessage({
              account: argv.account,
              channel: to[0] ?? "",
              text: requireBody(argv.body, argv.html),
              threadTs: argv.threadId,
              attach,
              asUser: argv.asUser,
              verbose: argv.verbose,
            })
      process.stdout.write(`${JSON.stringify(result)}\n`)
    },
  )
  .command(
    "gmail <command> [args..]",
    "Gmail auth and account management",
    cli =>
      cli
        .parserConfiguration({ "unknown-options-as-args": true })
        .positional("command", {
          type: "string",
          choices: ["auth", "accounts"] as const,
        })
        .positional("args", {
          type: "string",
          array: true,
        }),
    async argv => {
      let args = (argv.args as string[] | undefined) ?? []
      if (argv.command === "auth") {
        await parseGmailAuthCli(args)
        return
      }
      await parseGmailAccountsCli(args)
    },
  )
  .command(
    "messages <command> [args..]",
    "Messages account management",
    cli =>
      cli
        .parserConfiguration({ "unknown-options-as-args": true })
        .positional("command", {
          type: "string",
          choices: ["accounts"] as const,
        })
        .positional("args", {
          type: "string",
          array: true,
        }),
    async argv => {
      let args = (argv.args as string[] | undefined) ?? []
      await parseMessagesAccountsCli(args)
    },
  )
  .command(
    "slack <command> [args..]",
    "Slack auth and account management",
    cli =>
      cli
        .parserConfiguration({ "unknown-options-as-args": true })
        .positional("command", {
          type: "string",
          choices: ["auth", "accounts"] as const,
        })
        .positional("args", {
          type: "string",
          array: true,
        }),
    async argv => {
      let args = (argv.args as string[] | undefined) ?? []
      if (argv.command === "auth") {
        await parseSlackAuthCli(args)
        return
      }
      await parseSlackAccountsCli(args)
    },
  )
  .demandCommand(1)
  .strict()
  .help()
  .parseAsync()
