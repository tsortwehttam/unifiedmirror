import { getPlatformAdapter } from "./adapters/registry"
import type { AttachmentSelector, UnifiedRecord } from "./types"

export function selectorFromAttachment(params: {
  id: string | undefined
  filename: string | undefined
  index: number | undefined
}): AttachmentSelector {
  return {
    id: params.id,
    filename: params.filename,
    index: params.index ?? 0,
  }
}

export async function fetchAttachment(
  row: UnifiedRecord,
  selector: AttachmentSelector,
  account: string,
): Promise<Buffer | undefined> {
  let adapter = getPlatformAdapter(row.platform)
  return adapter.fetchAttachment?.(row, selector, account)
}
