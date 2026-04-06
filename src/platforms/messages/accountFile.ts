import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DEFAULT_ACCOUNT, resolveAllTokenDirs, resolveTokenReadPathsForAccount } from "../../config/CliConfig"
import { getMessagesConfigFromEnv } from "../../config/envCredentials"

export type MessagesAccountFile = {
  db_path: string | undefined
  attachments_root: string | undefined
  me: string | undefined
}

export type MessagesAccountConfig = {
  dbPath: string
  attachmentsRoot: string
  me: string | undefined
}

const DEFAULT_DB_PATH = path.resolve(os.homedir(), "Library", "Messages", "chat.db")
const DEFAULT_ATTACHMENTS_ROOT = path.resolve(os.homedir(), "Library", "Messages", "Attachments")

function expandHome(value: string): string {
  if (!value.startsWith("~/")) return path.resolve(value)
  return path.resolve(os.homedir(), value.slice(2))
}

function readAccountFile(account: string): MessagesAccountFile | undefined {
  let paths = resolveTokenReadPathsForAccount(account, "messages")
  let file = paths.find(value => fs.existsSync(value))
  if (!file) return undefined
  let raw = JSON.parse(fs.readFileSync(file, "utf8")) as MessagesAccountFile
  return {
    db_path: raw.db_path,
    attachments_root: raw.attachments_root,
    me: raw.me,
  }
}

export function resolveMessagesAccountConfig(account: string): MessagesAccountConfig {
  let env = getMessagesConfigFromEnv()
  if (env) {
    return {
      dbPath: expandHome(env.db_path),
      attachmentsRoot: expandHome(env.attachments_root ?? DEFAULT_ATTACHMENTS_ROOT),
      me: env.me,
    }
  }

  let file = readAccountFile(account)
  if (file?.db_path) {
    return {
      dbPath: expandHome(file.db_path),
      attachmentsRoot: expandHome(file.attachments_root ?? DEFAULT_ATTACHMENTS_ROOT),
      me: file.me,
    }
  }

  if (account === DEFAULT_ACCOUNT) {
    return {
      dbPath: DEFAULT_DB_PATH,
      attachmentsRoot: DEFAULT_ATTACHMENTS_ROOT,
      me: undefined,
    }
  }

  throw new Error(
    `Missing Messages account "${account}". Set UM_MESSAGES_DB_PATH or create ${account}.json in one of: ${resolveAllTokenDirs("messages").join(", ")}`,
  )
}
