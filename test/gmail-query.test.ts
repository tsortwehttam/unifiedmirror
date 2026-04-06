import assert from "node:assert/strict"
import test from "node:test"
import { buildGmailQuery } from "../src/platforms/gmail/GmailSource"

test("buildGmailQuery adds epoch bounds to the upstream Gmail query", () => {
  let query = buildGmailQuery({
    query: "in:inbox category:primary",
    since: "2026-03-17T00:00:00Z",
    until: "2026-03-22T23:59:59Z",
  })

  assert.equal(
    query,
    "in:inbox category:primary after:1773705600 before:1774224000",
  )
})

test("buildGmailQuery handles empty base query", () => {
  let query = buildGmailQuery({
    query: "",
    since: "2026-03-17T00:00:00Z",
    until: undefined,
  })

  assert.equal(query, "after:1773705600")
})
