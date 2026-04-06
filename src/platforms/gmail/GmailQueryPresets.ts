export const GMAIL_QUERY_PRESETS = {
  "all-mail": "in:anywhere",
  "primary-like": "in:anywhere -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash",
  "inbox-like": "in:inbox -category:promotions -category:social -category:updates -category:forums -in:spam -in:trash",
} as const

export type GmailQueryPreset = keyof typeof GMAIL_QUERY_PRESETS

export function isGmailQueryPreset(value: string): value is GmailQueryPreset {
  return value in GMAIL_QUERY_PRESETS
}

export function resolveGmailQuery(params: {
  preset: string | undefined
  query: string
}): string {
  let terms: string[] = []
  if (params.preset) {
    if (!isGmailQueryPreset(params.preset)) throw new Error(`Unknown Gmail preset "${params.preset}"`)
    terms.push(GMAIL_QUERY_PRESETS[params.preset])
  }
  if (params.query.trim()) terms.push(params.query.trim())
  return terms.join(" ").trim()
}
