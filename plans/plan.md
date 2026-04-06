# UnifiedMessage Port Plan

## Intent

Build a small TypeScript library and CLI for a single core contract:

- normalize Gmail and Slack messages into one `UnifiedMessage` shape
- pull messages from those platforms into JSONL
- send messages back through those platforms
- reuse `msgmon`'s credential resolution and auth flows

Out of scope for this pass:

- WhatsApp
- Teams
- Asana
- server/client workspace sync
- agent runtime features
- inbox/context routing concepts from `msgmon`

## Source Inventory From `~/Code/msgmon`

Code worth reworking, not copying verbatim:

- `src/CliConfig.ts`
  - config directory precedence
  - account token path resolution
- `platforms/gmail/auth.ts`
  - Gmail OAuth bootstrap
- `platforms/gmail/accounts.ts`
  - account discovery
- `platforms/gmail/MailSource.ts`
  - Gmail client creation
  - incremental listing
  - attachment fetch
  - mark-read helper
- `platforms/gmail/toUnifiedMessage.ts`
  - Gmail -> `UnifiedMessage`
- `platforms/slack/auth.ts`
  - bot-token auth
  - OAuth install flow
- `platforms/slack/accounts.ts`
  - Slack account discovery
- `platforms/slack/slackClient.ts`
  - token loading
  - read/send helpers
- `platforms/slack/SlackSource.ts`
  - channel resolution
  - history listing
  - mark-read helper
- `platforms/slack/toUnifiedMessage.ts`
  - Slack -> `UnifiedMessage`

Code to ignore for now:

- `serve/*`
- `session/*`
- `workspace/*`
- `draft/*`
- `setup/*`
- `corpus/*`
- non-Gmail/non-Slack platforms

## Target Shape

Keep the project tight around a few modules:

- `src/types.ts`
  - `Platform`
  - `UnifiedMessage`
  - `UnifiedAttachment`
  - platform metadata unions
- `src/config/CliConfig.ts`
  - inherited credential and token resolution
  - workspace-aware config precedence
- `src/platforms/gmail/*`
  - auth
  - accounts
  - client/source
  - normalize
- `src/platforms/slack/*`
  - auth
  - accounts
  - client/source
  - normalize
- `src/io/jsonl.ts`
  - append/read JSONL helpers
- `src/cli/*`
  - top-level `um`
  - `pull`
  - `send`
  - minimal platform subcommands for `auth` and `accounts`

No classes. No extra framework. Prefer pure normalization functions plus thin I/O wrappers.

## Proposed CLI Scope

First usable CLI:

- `um pull --platform=gmail|slack --account=... --dest=... --since=... --until=...`
- `um send --platform=gmail|slack ...`
- `um gmail auth`
- `um gmail accounts`
- `um slack auth`
- `um slack accounts`

Defer `edit` until the pull/send path is solid. The README mentions it, but it is not needed to stand up the core use case.

## Implementation Phases

### 1. Foundation

- convert repo from stub to module-based TS package
- add runtime deps from `msgmon` that we actually need:
  - `@google-cloud/local-auth`
  - `@slack/web-api`
  - `googleapis`
  - `tsx`
  - `yargs`
- define `UnifiedMessage` types from the README use case
- add JSONL helpers

### 2. Shared Config

- port config resolution from `msgmon/src/CliConfig.ts`
- use `.um` as the default config dir
- make the config root configurable so users can override it
- keep `.msgmon` as a fallback resolution source so existing credentials work immediately

Recommendation:

- write new credentials/tokens under `.um` by default
- resolve reads in this order:
  - explicit override
  - workspace-local `.um`
  - workspace-local `.msgmon`
  - install/global fallbacks in both namespaces as needed

### 3. Gmail Adapter

- port Gmail auth/accounts/client/source/normalize
- keep attachment extraction support
- keep Gmail send support from `msgmon/platforms/gmail/mail.ts` where relevant
- narrow exported surface to:
  - auth
  - accounts
  - list
  - send
  - normalize

### 4. Slack Adapter

- port Slack auth/accounts/client/source/normalize
- keep both bot-token and OAuth modes
- keep channel name -> ID resolution
- keep send + optional thread reply support
- exclude search/read CLI commands unless needed by `pull`/`send`

### 5. Top-Level CLI

- implement `um` entrypoint with `yargs`
- wire `pull` to platform adapters and JSONL output
- wire `send` to platform adapters
- expose minimal platform auth/account commands

### 6. Tests

Add unit tests for pure logic:

- config resolution precedence
- Gmail participant/header normalization
- Slack message normalization
- date/window parsing
- destination path resolution for JSONL output

Avoid networked integration tests in this pass.

### 7. Docs

- update `README.md` to match the actual implemented scope
- document credential layout and resolution order
- include Gmail and Slack setup instructions

## Design Constraints

- prefer extraction and simplification over preserving `msgmon` structure
- keep one source of truth for config resolution and shared types
- do not bring over server/workspace concepts
- do not preserve old abstractions if a smaller function set is enough here
- keep the output model centered on `UnifiedMessage`, not on source-specific command behavior

## Open Decisions To Confirm During Implementation

- exact `UnifiedMessage` shape:
  - keep close to `msgmon`
  - or expand now to better match the README's send/edit contract
- `dest` handling:
  - local directory only first
  - or include bucket URI parsing in the first pass

My recommendation for the first implementation:

- support local filesystem destinations only
- default to `.um`, with configurable root and `.msgmon` fallback
- keep the `UnifiedMessage` type close to `msgmon`, with only minimal renaming if needed

## Execution Order After Review

1. Set package metadata, dependencies, and repo layout.
2. Port shared config resolution and core types.
3. Port Gmail adapter and tests.
4. Port Slack adapter and tests.
5. Build `um pull` and `um send`.
6. Update README and run `yarn typecheck && yarn test`.
