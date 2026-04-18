# unifiedmirror

CLI and library for mirroring records from multiple platforms into one local JSONL dataset.

`unifiedmirror` is a downloader first. Each platform adapter normalizes remote objects into a shared `UnifiedRecord` shape so local data can be traversed, merged, searched, and explored together.

Current adapters:

- Gmail messages
- Slack messages
- macOS Messages messages
- Asana tasks and comments
- Shopify orders

## Install

```bash
git clone https://github.com/tsortwehttam/unifiedmirror.git
cd unifiedmirror
yarn install
```

## Setup

Credentials can come from config files or env vars. Env vars take priority.

Default config directory: `.unifiedmirror`

### Gmail

```bash
# Option A: config files
#   Place Google OAuth credentials at .unifiedmirror/gmail/credentials.json, then:
yarn unifiedmirror gmail auth --account personal

# Option B: env vars
export UNIFIEDMIRROR_GMAIL_CLIENT_ID=...
export UNIFIEDMIRROR_GMAIL_CLIENT_SECRET=...
export UNIFIEDMIRROR_GMAIL_ACCESS_TOKEN=...
export UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN=...
```

### Slack

```bash
# Option A: config files
yarn unifiedmirror slack auth --account work --token xoxb-...

# Option B: env vars
export UNIFIEDMIRROR_SLACK_BOT_TOKEN=xoxb-...
export UNIFIEDMIRROR_SLACK_USER_TOKEN=xoxp-...  # optional
```

### Messages (macOS)

Read-only pull support reads the local Messages SQLite database on macOS.

```bash
# Option A: use the default local database
#   Default account reads ~/Library/Messages/chat.db automatically.

# Option B: env vars
export UNIFIEDMIRROR_MESSAGES_DB_PATH=~/Library/Messages/chat.db
export UNIFIEDMIRROR_MESSAGES_ATTACHMENTS_ROOT=~/Library/Messages/Attachments  # optional
export UNIFIEDMIRROR_MESSAGES_ME='me@example.com'  # optional label for outgoing local rows

# Option C: account file
#   Put JSON at .unifiedmirror/messages/tokens/personal.json:
#   {"db_path":"~/Library/Messages/chat.db","attachments_root":"~/Library/Messages/Attachments","me":"me@example.com"}
```

The terminal app running `unifiedmirror` needs Full Disk Access to read `~/Library/Messages/chat.db`.

### Asana

```bash
# Option A: save PAT via CLI
printf '%s' "$ASANA_PAT" | yarn unifiedmirror asana auth --account work

# Option B: env vars
export UNIFIEDMIRROR_ASANA_PAT=...
export UNIFIEDMIRROR_ASANA_WORKSPACE_GID=...
```

### Shopify

Shopify supports either a static Admin API token or a Dev Dashboard app that exchanges client credentials for a short-lived Admin API token at runtime.

```bash
# Option A: env vars
export UNIFIEDMIRROR_SHOPIFY_SHOP=store.myshopify.com
export UNIFIEDMIRROR_SHOPIFY_ACCESS_TOKEN=shpat_...

# Option B: env vars for Dev Dashboard apps
export UNIFIEDMIRROR_SHOPIFY_SHOP=store.myshopify.com
export UNIFIEDMIRROR_SHOPIFY_CLIENT_ID=...
export UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET=...

# Option C: account file
#   Put JSON at .unifiedmirror/shopify/tokens/store.json:
#   {"shop":"store.myshopify.com","access_token":"shpat_..."}
```

## All env vars

| Var | Purpose |
|-----|---------|
| `UNIFIEDMIRROR_CONFIG_DIR` | Override config directory |
| `UNIFIEDMIRROR_GMAIL_CLIENT_ID` | Gmail OAuth client ID |
| `UNIFIEDMIRROR_GMAIL_CLIENT_SECRET` | Gmail OAuth client secret |
| `UNIFIEDMIRROR_GMAIL_REDIRECT_URI` | Gmail OAuth redirect URI |
| `UNIFIEDMIRROR_GMAIL_ACCESS_TOKEN` | Gmail OAuth access token |
| `UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token |
| `UNIFIEDMIRROR_SLACK_CLIENT_ID` | Slack app client ID |
| `UNIFIEDMIRROR_SLACK_CLIENT_SECRET` | Slack app client secret |
| `UNIFIEDMIRROR_SLACK_BOT_TOKEN` | Slack bot token |
| `UNIFIEDMIRROR_SLACK_USER_TOKEN` | Slack user token |
| `UNIFIEDMIRROR_MESSAGES_DB_PATH` | Override macOS Messages `chat.db` path |
| `UNIFIEDMIRROR_MESSAGES_ATTACHMENTS_ROOT` | Override macOS Messages attachments root |
| `UNIFIEDMIRROR_MESSAGES_ME` | Label/address to use for outgoing local Messages rows |
| `UNIFIEDMIRROR_ASANA_PAT` | Asana personal access token |
| `UNIFIEDMIRROR_ASANA_WORKSPACE_GID` | Asana workspace GID |
| `UNIFIEDMIRROR_SHOPIFY_SHOP` | Shopify shop domain, like `store.myshopify.com` |
| `UNIFIEDMIRROR_SHOPIFY_ACCESS_TOKEN` | Shopify Admin API access token |
| `UNIFIEDMIRROR_SHOPIFY_CLIENT_ID` | Shopify Dev Dashboard client ID |
| `UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET` | Shopify Dev Dashboard client secret |

## Record shape

All adapters normalize into a shared `UnifiedRecord` with:

- stable namespaced `id`
- `kind`
- `platform`
- `account`
- primary `timestamp` plus richer `timestamps`
- summary/body fields
- parties and participants
- attachments
- amounts, tags, status, url
- stable `threadId` and `parentId`
- source-specific `platformMetadata`

Platform metadata keeps the detailed native fields without forcing every platform into the same narrow schema.

## Pull records

```bash
yarn unifiedmirror pull --platform gmail --account personal --query 'in:inbox' --since 2026-03-01T00:00:00Z --dest ./out
yarn unifiedmirror pull --platform slack --account work --query '#general,#alerts' --since 2026-03-24T00:00:00Z --dest ./out
yarn unifiedmirror pull --platform messages --account default --query '+15551234567' --since 2026-03-24T00:00:00Z --dest ./out
yarn unifiedmirror pull --platform asana --account work --query '1200000000000001' --since 2026-03-01T00:00:00Z --dest ./out
yarn unifiedmirror pull --platform shopify --account store --query 'status:open' --since 2026-03-01T00:00:00Z --dest ./out
```

Output is JSONL. Pass a directory to `--dest` and it writes `records.jsonl` inside it.

Adapter-specific query behavior:

- Gmail: Gmail search query
- Slack: comma-separated channel names or IDs
- Messages: comma-separated chat identifiers, chat GUIDs, or handles
- Asana: comma-separated project GIDs
- Shopify: Shopify order search query

## Sync records

Use `sync` when you want deterministic merge and dedupe behavior for a local mirror.

```bash
yarn unifiedmirror sync --platform gmail --account default --preset primary-like --since 2026-03-01T00:00:00Z --until 2026-04-06T23:59:59Z --dest-root ./mirror/gmail/default --shard month --merge-by id --sort-by timestamp
yarn unifiedmirror sync --platform slack --account default --query '#founders,#production' --since 2026-03-01T00:00:00Z --until 2026-04-06T23:59:59Z --dest-root ./mirror/slack/default --shard month --merge-by id --sort-by timestamp --include-thread-replies
yarn unifiedmirror sync --platform shopify --account store --query 'financial_status:paid' --since 2026-03-01T00:00:00Z --until 2026-04-06T23:59:59Z --dest-root ./mirror/shopify/store --shard month --merge-by id --sort-by timestamp
yarn unifiedmirror sync --platform asana --account work --query '1200000000000001,1200000000000002' --dest-root ./mirror/asana/work --shard month --merge-by id --sort-by timestamp --current-state
```

With `--shard month`, `unifiedmirror` writes:

- `<dest-root>/<YYYY-MM>/records.jsonl`
- `<dest-root>/<YYYY-MM>/meta.json`

The sync path merges by record `id`, replaces older copies on collision, and sorts by timestamp.
During long syncs, shard files and manifests are updated incrementally as batches arrive so partial progress survives interruption.

For Asana, `--current-state` is the mode to use when you want a full project re-sync that refreshes existing task rows in place. In that mode the adapter re-reads every task plus optional comments/subtasks for the requested project GIDs, ignores `--since`, `--until`, and `--max-results`, and relies on `sync --merge-by id` to replace older local copies while leaving locally mirrored rows for deleted remote tasks untouched.

## Presets

Gmail presets:

- `all-mail`: `in:anywhere`
- `primary-like`: `in:anywhere -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash`
- `inbox-like`: `in:inbox -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash`

`--preset` can be combined with extra `--query` terms.

## Attachments

Unified rows include attachment metadata in `attachments`.

- Use `fetchAttachment(...)` and `selectorFromAttachment(...)` from `src/attachments.ts` for a stable cross-platform download API.
- Gmail attachments are fetched via the Gmail adapter.
- Slack file attachments are fetched via the Slack adapter.
- macOS Messages attachments are read from the local filesystem.
- Asana attachments are fetched with the Asana token.

## License

Apache-2.0
