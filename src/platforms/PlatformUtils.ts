import type { RecordKind, UnifiedParty, UnifiedTimestamps } from "../types"

export function buildRecordId(platform: string, account: string, kind: RecordKind, ...parts: string[]): string {
  return [platform, account, kind, ...parts].filter(Boolean).join(":")
}

export function pickTimestamp(timestamps: UnifiedTimestamps): string {
  return (
    timestamps.occurred ??
    timestamps.sent ??
    timestamps.received ??
    timestamps.created ??
    timestamps.updated ??
    new Date(0).toISOString()
  )
}

export function dedupeParties(parties: Array<UnifiedParty | undefined>): UnifiedParty[] {
  let out = new Map<string, UnifiedParty>()
  for (let party of parties) {
    if (!party) continue
    let key = [party.id ?? "", party.address, party.role ?? ""].join("|")
    if (!out.has(key)) out.set(key, party)
  }
  return Array.from(out.values())
}

export function trimSummary(value: string | undefined, max = 160): string | undefined {
  let text = value?.replace(/\s+/g, " ").trim()
  if (!text) return undefined
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}
