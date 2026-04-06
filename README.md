# um

CLI for pulling and sending messages across Gmail and Slack through one unified interface.

## Install

```bash
git clone https://github.com/tsortwehttam/unifiedmessage.git
cd unifiedmessage
yarn install
```

## Setup

### Gmail

```bash
# Place your Google OAuth credentials file at:
#   .um/gmail/credentials.json
# Then authenticate:
yarn um gmail auth --account personal
```

### Slack

```bash
# Token-based:
yarn um slack auth --account work --token xoxb-...

# Or OAuth (requires .um/slack/credentials.json with client_id and client_secret):
yarn um slack auth --account work --mode oauth
```

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
