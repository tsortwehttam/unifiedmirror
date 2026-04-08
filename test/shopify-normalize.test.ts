import assert from "node:assert/strict"
import test from "node:test"
import { toUnifiedRecord } from "../src/platforms/shopify/toUnifiedRecord"

test("shopify normalization maps orders into unified records", () => {
  let row = toUnifiedRecord(
    {
      id: "gid://shopify/Order/123",
      legacyResourceId: "123",
      name: "#1001",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "UNFULFILLED",
      createdAt: "2026-04-05T12:00:00Z",
      updatedAt: "2026-04-05T12:30:00Z",
      processedAt: "2026-04-05T12:05:00Z",
      closedAt: undefined,
      cancelledAt: undefined,
      cancelReason: undefined,
      confirmed: true,
      tags: ["vip", "wholesale"],
      note: "Priority customer",
      email: "buyer@example.com",
      currentSubtotalPriceSet: { shopMoney: { amount: "90.00", currencyCode: "USD" } },
      currentTotalTaxSet: { shopMoney: { amount: "8.10", currencyCode: "USD" } },
      currentShippingPriceSet: { shopMoney: { amount: "5.00", currencyCode: "USD" } },
      currentTotalPriceSet: { shopMoney: { amount: "103.10", currencyCode: "USD" } },
      totalRefundedSet: { shopMoney: { amount: "0.00", currencyCode: "USD" } },
      customer: {
        id: "gid://shopify/Customer/999",
        displayName: "Alice Example",
        firstName: "Alice",
        lastName: "Example",
        email: "buyer@example.com",
      },
      lineItems: {
        nodes: [
          {
            id: "gid://shopify/LineItem/1",
            name: "Blue Shirt",
            sku: "SKU-1",
            quantity: 2,
            variantTitle: "XL",
          },
        ],
      },
    },
    "default",
    "store.myshopify.com",
  )

  assert.equal(row.kind, "order")
  assert.equal(row.id, "shopify:default:order:123")
  assert.equal(row.from?.address, "buyer@example.com")
  assert.equal(row.to[0]?.address, "store.myshopify.com")
  assert.equal(row.amounts.find(amount => amount.kind === "total")?.value, "103.10")
  assert.equal(row.platformMetadata.platform, "shopify")
  assert.equal(row.threadId, "shopify:default:order:thread:999")
})
