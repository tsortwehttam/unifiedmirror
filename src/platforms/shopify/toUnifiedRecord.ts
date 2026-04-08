import type { ShopifyMetadata, UnifiedAmount, UnifiedParty, UnifiedRecord } from "../../types"
import { buildRecordId, dedupeParties, trimSummary } from "../PlatformUtils"

export type ShopifyOrderNode = {
  id: string
  legacyResourceId: string
  name: string
  displayFinancialStatus: string | undefined
  displayFulfillmentStatus: string | undefined
  createdAt: string
  updatedAt: string
  processedAt: string | undefined
  closedAt: string | undefined
  cancelledAt: string | undefined
  cancelReason: string | undefined
  confirmed: boolean
  tags: string[]
  note: string | undefined
  email: string | undefined
  currentSubtotalPriceSet: {
    shopMoney: { amount: string; currencyCode: string }
  } | undefined
  currentTotalTaxSet: {
    shopMoney: { amount: string; currencyCode: string }
  } | undefined
  currentShippingPriceSet: {
    shopMoney: { amount: string; currencyCode: string }
  } | undefined
  currentTotalPriceSet: {
    shopMoney: { amount: string; currencyCode: string }
  } | undefined
  totalRefundedSet: {
    shopMoney: { amount: string; currencyCode: string }
  } | undefined
  customer: {
    id: string
    displayName: string | undefined
    firstName: string | undefined
    lastName: string | undefined
    email: string | undefined
  } | undefined
  lineItems: {
    nodes: Array<{
      id: string
      name: string
      sku: string | undefined
      quantity: number
      variantTitle: string | undefined
    }>
  }
}

function toMoney(kind: string, value: { shopMoney: { amount: string; currencyCode: string } } | undefined): UnifiedAmount[] {
  if (!value) return []
  return [{ kind, currency: value.shopMoney.currencyCode, value: value.shopMoney.amount }]
}

function toCustomerParty(order: ShopifyOrderNode): UnifiedParty | undefined {
  let customer = order.customer
  let address = customer?.email ?? order.email
  if (!address) return undefined
  let fullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ")
  let name = customer?.displayName ?? (fullName || undefined)
  return {
    id: customer?.id,
    address,
    name,
    role: "customer",
  }
}

export function toUnifiedRecord(order: ShopifyOrderNode, account: string, shop: string): UnifiedRecord {
  let from = toCustomerParty(order)
  let to: UnifiedParty[] = [{ id: shop, address: shop, name: shop, role: "shop" }]
  let amounts = [
    ...toMoney("subtotal", order.currentSubtotalPriceSet),
    ...toMoney("tax", order.currentTotalTaxSet),
    ...toMoney("shipping", order.currentShippingPriceSet),
    ...toMoney("total", order.currentTotalPriceSet),
    ...toMoney("refunded", order.totalRefundedSet),
  ]
  let summary = trimSummary(
    [
      order.name,
      from?.name ?? from?.address,
      order.lineItems.nodes.length ? `${order.lineItems.nodes.length} items` : undefined,
      amounts.find(amount => amount.kind === "total")?.value ? `${amounts.find(amount => amount.kind === "total")?.value} ${amounts.find(amount => amount.kind === "total")?.currency}` : undefined,
      order.displayFinancialStatus,
      order.displayFulfillmentStatus,
    ]
      .filter(Boolean)
      .join(" · "),
  )
  let customerId = order.customer?.id ? order.customer.id.split("/").pop() : undefined
  let orderId = order.id.split("/").pop() ?? order.id
  let threadId = buildRecordId("shopify", account, "order", "thread", customerId ?? orderId)
  let metadata: ShopifyMetadata = {
    platform: "shopify",
    shop,
    orderId,
    legacyResourceId: order.legacyResourceId,
    orderNumber: Number(order.name.replace(/[^\d]/g, "")) || undefined,
    displayName: order.name,
    customerId,
    customerEmail: from?.address,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    cancelReason: order.cancelReason,
    closedAt: order.closedAt,
    cancelledAt: order.cancelledAt,
    confirmed: order.confirmed,
    tags: order.tags,
    lineItems: order.lineItems.nodes.map(item => ({
      id: item.id.split("/").pop() ?? item.id,
      title: item.name,
      sku: item.sku,
      quantity: item.quantity,
      variantTitle: item.variantTitle,
    })),
  }

  return {
    id: buildRecordId("shopify", account, "order", orderId),
    kind: "order",
    platform: "shopify",
    account,
    timestamp: order.createdAt,
    timestamps: {
      created: order.createdAt,
      updated: order.updatedAt,
      occurred: order.processedAt ?? order.createdAt,
      sent: undefined,
      received: order.createdAt,
    },
    subject: order.name,
    summary,
    bodyText: order.note,
    bodyHtml: undefined,
    from,
    to,
    cc: [],
    bcc: [],
    participants: dedupeParties([from, ...to]),
    attachments: [],
    amounts,
    tags: order.tags,
    status: [order.displayFinancialStatus, order.displayFulfillmentStatus].filter(Boolean).join(" / ") || undefined,
    url: `https://${shop}/admin/orders/${order.legacyResourceId}`,
    threadId,
    parentId: undefined,
    platformMetadata: metadata,
  }
}
