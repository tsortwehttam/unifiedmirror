import assert from "node:assert/strict"
import test from "node:test"
import { buildShopifyQuery } from "../src/platforms/shopify/ShopifySource"

test("buildShopifyQuery merges base query with created_at bounds", () => {
  assert.equal(
    buildShopifyQuery("status:any", "2026-03-01T00:00:00Z", "2026-04-09T00:00:00Z"),
    "status:any created_at:>=2026-03-01T00:00:00Z created_at:<2026-04-09T00:00:00Z",
  )
})

test("buildShopifyQuery returns undefined when no filters are provided", () => {
  assert.equal(buildShopifyQuery("", undefined, undefined), undefined)
})
