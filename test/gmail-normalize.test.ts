import assert from "node:assert/strict"
import test from "node:test"
import { isCalendarInviteSubject, stripQuotedReply, toUnifiedRecord } from "../src/platforms/gmail/toUnifiedRecord"

test("gmail normalization extracts participants and bodies", () => {
  let row = toUnifiedRecord({
    id: "m1",
    threadId: "t1",
    internalDate: String(Date.parse("2026-03-20T10:00:00Z")),
    labelIds: ["INBOX"],
    payload: {
      headers: [
        { name: "From", value: "Alice <alice@example.com>" },
        { name: "To", value: "Bob <bob@example.com>" },
        { name: "Cc", value: "Carol <carol@example.com>" },
        { name: "Subject", value: "Hello" },
        { name: "Message-ID", value: "<m1@example.com>" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from("hi there", "utf8").toString("base64url"),
          },
        },
      ],
    },
  }, "default")

  assert.equal(row.platform, "gmail")
  assert.equal(row.from?.address, "alice@example.com")
  assert.equal(row.to[0]?.address, "bob@example.com")
  assert.equal(row.cc[0]?.address, "carol@example.com")
  assert.equal(row.bodyText, "hi there")
  assert.equal(row.bodyHtml, undefined)
  assert.equal(row.kind, "message")
  assert.equal(row.platformMetadata.platform, "gmail")
})

test("stripQuotedReply removes Gmail reply quote", () => {
  let body = [
    "Thanks, that makes sense.",
    "",
    "On Mon, Nov 14, 2025 at 5:47 AM, Kat Eastham <kat@example.com> wrote:",
    "> Hi Matthew!",
    "> Previous content here",
  ].join("\n")
  assert.equal(stripQuotedReply(body), "Thanks, that makes sense.")
})

test("stripQuotedReply removes Outlook separator quote", () => {
  let body = [
    "Hi Matthew,",
    "See below for context.",
    "",
    "________________________________",
    "From: Nathanael Smith <nate@example.com>",
    "Sent: Monday, April 7, 2025 10:30:14 PM",
    "To: Kat Eastham",
    "Subject: Re: something",
    "",
    "Original body text",
  ].join("\n")
  assert.equal(stripQuotedReply(body), "Hi Matthew,\nSee below for context.")
})

test("stripQuotedReply leaves unquoted bodies alone", () => {
  assert.equal(stripQuotedReply("Just a plain message."), "Just a plain message.")
})

test("isCalendarInviteSubject matches common prefixes", () => {
  assert.equal(isCalendarInviteSubject("Accepted: Sync @ Mon"), true)
  assert.equal(isCalendarInviteSubject("Declined: Standup"), true)
  assert.equal(isCalendarInviteSubject("Updated invitation: Meeting"), true)
  assert.equal(isCalendarInviteSubject("Invitation: Kickoff"), true)
  assert.equal(isCalendarInviteSubject("Canceled: Lunch"), true)
  assert.equal(isCalendarInviteSubject("Re: Invitation to Faire"), false)
  assert.equal(isCalendarInviteSubject("Regular email"), false)
  assert.equal(isCalendarInviteSubject(undefined), false)
})
