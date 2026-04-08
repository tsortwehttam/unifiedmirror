import type { AttachmentSelector, Platform, UnifiedRecord } from "../types"

export type AdapterCliOption = {
  name: string
  type: "boolean" | "number" | "string"
  default: boolean | number | string | undefined
  choices: string[]
  describe: string | undefined
}

export type AdapterListParams = {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
  options: Record<string, boolean | number | string | undefined>
}

export type PlatformAdapter = {
  platform: Platform
  kinds: string[]
  listRecords(params: AdapterListParams): Promise<UnifiedRecord[]>
  fetchAttachment: ((row: UnifiedRecord, selector: AttachmentSelector, account: string) => Promise<Buffer | undefined>) | undefined
  parseAccountsCli: ((args: string[]) => Promise<void>) | undefined
  parseAuthCli: ((args: string[]) => Promise<void>) | undefined
  pullOptions: AdapterCliOption[]
}
