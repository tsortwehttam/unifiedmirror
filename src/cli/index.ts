import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { DEFAULT_ACCOUNT } from "../config/CliConfig"
import { appendJsonl, resolveJsonlDest } from "../io/JsonlUtils"
import { parseAccountsCli as parseGmailAccountsCli } from "../platforms/gmail/accounts"
import { parseAuthCli as parseGmailAuthCli } from "../platforms/gmail/auth"
import { sendGmailMessage } from "../platforms/gmail/GmailSend"
import { listGmailMessages } from "../platforms/gmail/GmailSource"
import { parseAccountsCli as parseMessagesAccountsCli } from "../platforms/messages/accounts"
import { listMessagesMessages } from "../platforms/messages/MessagesSource"
import { parseAccountsCli as parseSlackAccountsCli } from "../platforms/slack/accounts"
import { parseAuthCli as parseSlackAuthCli } from "../platforms/slack/auth"
import { sendSlackMessage } from "../platforms/slack/SlackSend"
import { listSlackMessages } from "../platforms/slack/SlackSource"

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

await yargs(hideBin(process.argv))
  .scriptName("um")
  .command(
    "pull",
    "Pull unified messages from Gmail, Slack, or Messages and append them to JSONL",
    cli =>
      cli
        .option("platform", {
          type: "string",
          choices: ["gmail", "slack", "messages"] as const,
          demandOption: true,
        })
        .option("account", {
          type: "string",
          default: DEFAULT_ACCOUNT,
        })
        .option("dest", {
          type: "string",
          describe: "Output directory or .jsonl path",
        })
        .option("query", {
          type: "string",
          default: "",
          describe: "Platform-specific filter. For Slack, comma-separated channel names or IDs. For Messages, comma-separated chat identifiers, chat GUIDs, or handles.",
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
        .option("verbose", {
          alias: "v",
          type: "boolean",
          default: false,
        }),
    async argv => {
      let rows =
        argv.platform === "gmail"
          ? await listGmailMessages({
              account: argv.account,
              query: argv.query,
              since: argv.since,
              until: argv.until,
              maxResults: argv.maxResults,
              verbose: argv.verbose,
            })
          : argv.platform === "slack"
            ? await listSlackMessages({
                account: argv.account,
                query: argv.query,
                since: argv.since,
                until: argv.until,
                maxResults: argv.maxResults,
                verbose: argv.verbose,
              })
            : await listMessagesMessages({
                account: argv.account,
                query: argv.query,
                since: argv.since,
                until: argv.until,
                maxResults: argv.maxResults,
                verbose: argv.verbose,
              })

      let dest = resolveJsonlDest(argv.dest)
      appendJsonl(dest, rows)
      process.stdout.write(`${JSON.stringify({ wrote: rows.length, dest })}\n`)
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
