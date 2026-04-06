# um

CLI for pulling and sending messages across Gmail and Slack through one unified interface.

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

## Pull messages

```bash
yarn um pull --platform gmail --account personal --query 'in:inbox' --since 2026-03-01T00:00:00Z --dest ./out
yarn um pull --platform slack --account work --query '#general,#alerts' --since 2026-03-24T00:00:00Z --dest ./out
```

Output is JSONL. Pass a directory to `--dest` and it writes `messages.jsonl` inside it.

## Send messages

```bash
yarn um send --platform gmail --account personal --to alice@example.com --subject 'Hello' --body 'Hi there'
yarn um send --platform slack --account work --to '#general' --body 'Daily update'
```

## License

Apache-2.0
