import yargs, { type Argv } from "yargs"
import { hideBin } from "yargs/helpers"
import { getPlatformAdapter, listPlatforms } from "../adapters/registry"
import { DEFAULT_ACCOUNT } from "../config/CliConfig"
import { appendJsonl, resolveJsonlDest } from "../io/JsonlUtils"
import { syncJsonl, type MergeBy, type ShardMode, type SortBy } from "../io/SyncUtils"
import type { Platform, UnifiedRecord } from "../types"

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
  if (listPlatforms().includes(platform as Platform)) return platform as Platform
  throw new Error(`Unknown platform "${platform}"`)
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function addAdapterOptions<T>(cli: Argv<T>): Argv<T> {
  let out = cli
  for (let platform of listPlatforms()) {
    for (let option of getPlatformAdapter(platform).pullOptions) {
      out = out.option(option.name, {
        type: option.type,
        default: option.default,
        choices: option.choices.length ? option.choices : undefined,
        describe: option.describe,
      })
    }
  }
  return out
}

function addPullOptions<T>(cli: Argv<T>): Argv<T> {
  return addAdapterOptions(
    cli
      .option("platform", {
        type: "string",
        choices: listPlatforms(),
        demandOption: true,
      })
      .option("account", {
        type: "string",
        default: DEFAULT_ACCOUNT,
      })
      .option("query", {
        type: "string",
        default: "",
        describe: "Platform-specific filter.",
      })
      .option("preset", {
        type: "string",
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
  )
}

function toAdapterOptions(platform: Platform, argv: Record<string, unknown>): Record<string, boolean | number | string | undefined> {
  let out: Record<string, boolean | number | string | undefined> = {}
  for (let option of getPlatformAdapter(platform).pullOptions) {
    out[toCamelCase(option.name)] = argv[toCamelCase(option.name)] as boolean | number | string | undefined
  }
  return out
}

async function pullRows(params: {
  platform: Platform
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
  options: Record<string, boolean | number | string | undefined>
}): Promise<UnifiedRecord[]> {
  let adapter = getPlatformAdapter(params.platform)
  return adapter.listRecords(params)
}

let cli = yargs(hideBin(process.argv)).scriptName("unifiedmirror")

cli = cli.command(
  "pull",
  "Pull unified records from a platform and append them to JSONL",
  builder =>
    addPullOptions(builder).option("dest", {
      type: "string",
      describe: "Output directory or .jsonl path",
    }),
  async argv => {
    let platform = toPlatformArg(argv.platform)
    let rows = await pullRows({
      platform,
      account: toStringArg(argv.account),
      query: toStringArg(argv.query),
      preset: toMaybeStringArg(argv.preset),
      since: toMaybeStringArg(argv.since),
      until: toMaybeStringArg(argv.until),
      maxResults: toNumberArg(argv.maxResults),
      verbose: toBooleanArg(argv.verbose),
      options: toAdapterOptions(platform, argv as Record<string, unknown>),
    })

    let dest = resolveJsonlDest(toMaybeStringArg(argv.dest))
    appendJsonl(dest, rows)
    process.stdout.write(`${JSON.stringify({ wrote: rows.length, dest })}\n`)
  },
)

cli = cli.command(
  "sync",
  "Pull unified records and merge them into deterministic JSONL shards",
  builder =>
    addPullOptions(builder)
      .option("dest-root", {
        type: "string",
        demandOption: true,
        describe: "Output directory root. With --shard month, files land in <dest-root>/<YYYY-MM>/records.jsonl.",
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
    let platform = toPlatformArg(argv.platform)
    let options = toAdapterOptions(platform, argv as Record<string, unknown>)
    let rows = await pullRows({
      platform,
      account: toStringArg(argv.account),
      query: toStringArg(argv.query),
      preset: toMaybeStringArg(argv.preset),
      since: toMaybeStringArg(argv.since),
      until: toMaybeStringArg(argv.until),
      maxResults: toNumberArg(argv.maxResults),
      verbose: toBooleanArg(argv.verbose),
      options,
    })

    let writes = syncJsonl({
      rows,
      destRoot: toStringArg(argv.destRoot),
      platform,
      account: toStringArg(argv.account),
      kinds: getPlatformAdapter(platform).kinds,
      query: toStringArg(argv.query),
      preset: toMaybeStringArg(argv.preset),
      since: toMaybeStringArg(argv.since),
      until: toMaybeStringArg(argv.until),
      shard: toStringArg(argv.shard) as ShardMode,
      mergeBy: toStringArg(argv.mergeBy) as MergeBy,
      sortBy: toStringArg(argv.sortBy) as SortBy,
      options,
    })

    process.stdout.write(`${JSON.stringify({ wrote: rows.length, shards: writes })}\n`)
  },
)

for (let platform of listPlatforms()) {
  let adapter = getPlatformAdapter(platform)
  let commands = [
    ...(adapter.parseAuthCli ? ["auth"] : []),
    ...(adapter.parseAccountsCli ? ["accounts"] : []),
  ]
  if (!commands.length) continue

  cli = cli.command(
    `${platform} <command> [args..]`,
    `${platform} auth and account management`,
    builder =>
      builder
        .parserConfiguration({ "unknown-options-as-args": true })
        .positional("command", {
          type: "string",
          choices: commands,
        })
        .positional("args", {
          type: "string",
          array: true,
        }),
    async argv => {
      let args = (argv.args as string[] | undefined) ?? []
      if (argv.command === "auth") {
        if (!adapter.parseAuthCli) throw new Error(`No auth flow for ${platform}`)
        await adapter.parseAuthCli(args)
        return
      }
      if (!adapter.parseAccountsCli) throw new Error(`No accounts command for ${platform}`)
      await adapter.parseAccountsCli(args)
    },
  )
}

await cli.demandCommand(1).strict().help().parseAsync()
