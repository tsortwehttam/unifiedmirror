import fs from "node:fs"
import path from "node:path"
import { gmailClient } from "./GmailClient"

type AttachmentInput = string

function base64url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function chunk76(value: string): string {
  return (value.match(/.{1,76}/g) ?? []).join("\r\n")
}

function encodeQuotedPrintable(value: string): string {
  let lines = value.split(/\r?\n/)
  let out: string[] = []
  for (let line of lines) {
    let current = ""
    for (let index = 0; index < line.length; index += 1) {
      let char = line[index]
      let code = line.charCodeAt(index)
      let bytes = Buffer.from(char, "utf8")
      let next =
        bytes.length === 1 && code >= 33 && code <= 126 && code !== 61
          ? char
          : (code === 9 || code === 32) && index < line.length - 1
            ? char
            : Array.from(bytes)
                .map(value => `=${value.toString(16).toUpperCase().padStart(2, "0")}`)
                .join("")
      if (current.length + next.length > 75) {
        out.push(`${current}=`)
        current = next
      } else {
        current += next
      }
    }
    out.push(current)
  }
  return out.join("\r\n")
}

function guessMimeType(filePath: string): string {
  let ext = path.extname(filePath).toLowerCase()
  if (ext === ".txt") return "text/plain"
  if (ext === ".html" || ext === ".htm") return "text/html"
  if (ext === ".json") return "application/json"
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".csv") return "text/csv"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".gif") return "image/gif"
  if (ext === ".webp") return "image/webp"
  return "application/octet-stream"
}

function normalizeMessageId(value: string | undefined): string | undefined {
  let trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed
  if (!trimmed.includes("@")) return undefined
  return `<${trimmed}>`
}

function dedupeReferences(value: string | undefined): string | undefined {
  if (!value) return undefined
  let refs = value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => (item.startsWith("<") && item.endsWith(">") ? item : normalizeMessageId(item) ?? `<${item}>`))
  return Array.from(new Set(refs)).join(" ")
}

function buildMessageId(from: string | undefined): string {
  let domain = from?.split("@")[1] ?? "localhost"
  return `<${crypto.randomUUID().replace(/-/g, "")}.${Date.now()}@${domain}>`
}

function buildRawMessage(params: {
  from: string | undefined
  to: string[]
  cc: string[]
  bcc: string[]
  replyTo: string | undefined
  inReplyTo: string | undefined
  references: string | undefined
  messageId: string | undefined
  subject: string
  body: string
  attach: AttachmentInput[]
}): string {
  let inReplyTo = normalizeMessageId(params.inReplyTo)
  let references = dedupeReferences([params.references, inReplyTo].filter(Boolean).join(" ").trim() || undefined)
  let headers = [
    ...(params.from ? [`From: ${params.from}`] : []),
    `To: ${params.to.join(", ")}`,
    ...(params.cc.length > 0 ? [`Cc: ${params.cc.join(", ")}`] : []),
    ...(params.bcc.length > 0 ? [`Bcc: ${params.bcc.join(", ")}`] : []),
    ...(params.replyTo ? [`Reply-To: ${params.replyTo}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    `Subject: ${params.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${normalizeMessageId(params.messageId) ?? buildMessageId(params.from)}`,
    "MIME-Version: 1.0",
    "X-Mailer: um/0.1.0",
  ]

  if (params.attach.length === 0) {
    return `${headers.join("\r\n")}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${encodeQuotedPrintable(params.body)}`
  }

  let boundary = `um_${Date.now()}_${Math.random().toString(36).slice(2)}`
  let parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${encodeQuotedPrintable(params.body)}\r\n`,
    ...params.attach.map(filePath => {
      let filename = path.basename(filePath).replace(/"/g, "")
      let content = fs.readFileSync(filePath).toString("base64")
      let mimeType = guessMimeType(filePath)
      return (
        `--${boundary}\r\n` +
        `Content-Type: ${mimeType}; name="${filename}"\r\n` +
        "Content-Transfer-Encoding: base64\r\n" +
        `Content-Disposition: attachment; filename="${filename}"\r\n\r\n` +
        `${chunk76(content)}\r\n`
      )
    }),
    `--${boundary}--`,
  ]

  return `${headers.join("\r\n")}\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n${parts.join("")}`
}

export async function sendGmailMessage(params: {
  account: string
  from: string | undefined
  to: string[]
  cc: string[]
  bcc: string[]
  replyTo: string | undefined
  inReplyTo: string | undefined
  references: string | undefined
  messageId: string | undefined
  subject: string
  body: string
  attach: string[]
  threadId: string | undefined
  verbose: boolean
}) {
  if (params.to.length === 0) throw new Error("gmail send requires at least one recipient")
  let raw = buildRawMessage({
    from: params.from,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    replyTo: params.replyTo,
    inReplyTo: params.inReplyTo,
    references: params.references,
    messageId: params.messageId,
    subject: params.subject,
    body: params.body,
    attach: params.attach,
  })
  let res = await gmailClient(params.account, params.verbose).users.messages.send({
    userId: "me",
    requestBody: {
      raw: base64url(raw),
      threadId: params.threadId,
    },
  })
  return {
    id: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  }
}
