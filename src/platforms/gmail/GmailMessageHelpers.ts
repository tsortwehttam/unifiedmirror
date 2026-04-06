import type { gmail_v1 } from "googleapis"

export function decodeBase64Url(value: string | undefined): string {
  if (!value) return ""
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  let padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, "base64").toString("utf8")
}

export function headerMap(msg: gmail_v1.Schema$Message): Record<string, string> {
  let out: Record<string, string> = {}
  for (let header of msg.payload?.headers ?? []) {
    if (!header.name || header.value == null) continue
    out[header.name.toLowerCase()] = header.value
  }
  return out
}

export function pickBody(part: gmail_v1.Schema$MessagePart | undefined): { text: string | undefined; html: string | undefined } {
  if (!part) return { text: undefined, html: undefined }
  if (part.mimeType === "text/plain") return { text: decodeBase64Url(part.body?.data ?? undefined), html: undefined }
  if (part.mimeType === "text/html") return { text: undefined, html: decodeBase64Url(part.body?.data ?? undefined) }
  for (let child of part.parts ?? []) {
    let body = pickBody(child)
    if (body.text || body.html) return body
  }
  return { text: undefined, html: undefined }
}

export type FoundAttachment = {
  filename: string
  mimeType: string | undefined
  attachmentId: string | undefined
  inlineData: string | undefined
}

export function collectAttachments(
  part: gmail_v1.Schema$MessagePart | undefined,
  out: FoundAttachment[] = [],
): FoundAttachment[] {
  if (!part) return out
  if (part.filename) {
    out.push({
      filename: part.filename,
      mimeType: part.mimeType ?? undefined,
      attachmentId: part.body?.attachmentId ?? undefined,
      inlineData: part.body?.data ?? undefined,
    })
  }
  for (let child of part.parts ?? []) {
    collectAttachments(child, out)
  }
  return out
}
