# um

CLI for pulling and sending messages across Gmail, Slack, and macOS Messages through one unified interface.

## Install

```bash
git clone https://github.com/tsortwehttam/unifiedmessage.git
cd unifiedmessage
yarn install
```

## Setup

Credentials can come from config files or env vars. Env vars take priority.

### Gmail

```bash
# Option A: config files
#   Place your Google OAuth credentials at .um/gmail/credentials.json, then:
yarn um gmail auth --account personal

# Option B: env vars (for pull/send — auth flow still needs the file)
export UM_GMAIL_CLIENT_ID=...
export UM_GMAIL_CLIENT_SECRET=...
export UM_GMAIL_ACCESS_TOKEN=...
export UM_GMAIL_REFRESH_TOKEN=...
```

### Slack

```bash
# Option A: config files
yarn um slack auth --account work --token xoxb-...

# Option B: env vars
export UM_SLACK_BOT_TOKEN=xoxb-...
export UM_SLACK_USER_TOKEN=xoxp-...  # optional
```

### Messages (macOS)

Read-only pull support reads the local Messages SQLite database on macOS.

```bash
# Option A: use the default local database
#   Default account reads ~/Library/Messages/chat.db automatically.

# Option B: env vars
export UM_MESSAGES_DB_PATH=~/Library/Messages/chat.db
export UM_MESSAGES_ATTACHMENTS_ROOT=~/Library/Messages/Attachments  # optional
export UM_MESSAGES_ME='me@example.com'  # optional label for outgoing messages

# Option C: account file
#   Put JSON at .um/messages/tokens/personal.json:
#   {"db_path":"~/Library/Messages/chat.db","attachments_root":"~/Library/Messages/Attachments","me":"me@example.com"}
```

The terminal app running `um` needs Full Disk Access to read `~/Library/Messages/chat.db`.

### All env vars

| Var | Purpose |
|-----|---------|
| `UM_CONFIG_DIR` | Override config directory |
| `UM_GMAIL_CLIENT_ID` | Gmail OAuth client ID |
| `UM_GMAIL_CLIENT_SECRET` | Gmail OAuth client secret |
| `UM_GMAIL_REDIRECT_URI` | Gmail OAuth redirect URI (optional) |
| `UM_GMAIL_ACCESS_TOKEN` | Gmail OAuth access token |
| `UM_GMAIL_REFRESH_TOKEN` | Gmail OAuth refresh token |
| `UM_SLACK_CLIENT_ID` | Slack app client ID |
| `UM_SLACK_CLIENT_SECRET` | Slack app client secret |
| `UM_SLACK_BOT_TOKEN` | Slack bot token |
| `UM_SLACK_USER_TOKEN` | Slack user token (optional) |
| `UM_MESSAGES_DB_PATH` | Override macOS Messages `chat.db` path |
| `UM_MESSAGES_ATTACHMENTS_ROOT` | Override macOS Messages attachments root |
| `UM_MESSAGES_ME` | Label/address to use for outgoing local Messages rows |

## Pull messages

```bash
yarn um pull --platform gmail --account personal --query 'in:inbox' --since 2026-03-01T00:00:00Z --dest ./out
yarn um pull --platform slack --account work --query '#general,#alerts' --since 2026-03-24T00:00:00Z --dest ./out
yarn um pull --platform messages --account default --query '+15551234567' --since 2026-03-24T00:00:00Z --dest ./out
```

Output is JSONL. Pass a directory to `--dest` and it writes `messages.jsonl` inside it.

Slack pulls include thread replies for messages returned by the channel history scan unless `--include-thread-replies=false` is passed.

## Sync messages

Use `sync` when you want deterministic merge/dedupe behavior instead of append-only output.

```bash
yarn um sync --platform gmail --account default --preset primary-like --since 2026-03-01T00:00:00Z --until 2026-04-06T23:59:59Z --dest-root ./msgs/gmail/default/by-month --shard month --merge-by id --sort-by timestamp
yarn um sync --platform slack --account default --query '#founders,#production' --since 2026-03-01T00:00:00Z --until 2026-04-06T23:59:59Z --dest-root ./msgs/slack/default/by-month --shard month --merge-by id --sort-by timestamp --include-thread-replies
```

With `--shard month`, `um` writes:

- `<dest-root>/<YYYY-MM>/messages.jsonl`
- `<dest-root>/<YYYY-MM>/meta.json`

The sync path merges by message `id`, replaces older copies on collision, and sorts by timestamp.

## Gmail presets

Available Gmail query presets:

- `all-mail`: `in:anywhere`
- `primary-like`: `in:anywhere -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash`
- `inbox-like`: `in:inbox -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash`

`--preset` can be combined with extra `--query` terms.

## Attachments

Unified rows include attachment metadata in `attachments`.

- Use `fetchAttachment(...)` and `selectorFromAttachment(...)` from `src/attachments.ts` for a stable cross-platform download API.
- Gmail attachments are fetched via `src/platforms/gmail/GmailSource.ts`.
- Slack file attachments are fetched via `src/platforms/slack/SlackSource.ts`.

Slack downloads use the configured bot or user token to read private file URLs.

Selectors can target an attachment by platform attachment id, or by filename plus ordinal index when duplicate filenames exist.

For Messages, `--query` accepts a comma-separated list of chat identifiers, chat GUIDs, or handle IDs. Leave it empty to scan all chats.

## Send messages

```bash
yarn um send --platform gmail --account personal --to alice@example.com --subject 'Hello' --body 'Hi there'
yarn um send --platform slack --account work --to '#general' --body 'Daily update'
```

## License

Apache-2.0
