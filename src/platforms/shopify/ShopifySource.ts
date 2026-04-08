import type { UnifiedRecord } from "../../types"
import { shopifyClient, shopifyGraphql } from "./shopifyClient"
import { toUnifiedRecord, type ShopifyOrderNode } from "./toUnifiedRecord"

type ShopifyOrdersResponse = {
  orders: {
    nodes: ShopifyOrderNode[]
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | undefined
    }
  }
}

const ORDERS_QUERY = `
  query Orders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        legacyResourceId
        name
        displayFinancialStatus
        displayFulfillmentStatus
        createdAt
        updatedAt
        processedAt
        closedAt
        cancelledAt
        cancelReason
        confirmed
        tags
        note
        email
        currentSubtotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalTaxSet { shopMoney { amount currencyCode } }
        currentShippingPriceSet { shopMoney { amount currencyCode } }
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } }
        customer {
          id
          displayName
          firstName
          lastName
          email
        }
        lineItems(first: 50) {
          nodes {
            id
            name
            sku
            quantity
            variantTitle
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

function parseTime(value: string | undefined): number | undefined {
  if (!value) return undefined
  let time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error(`Invalid time bound "${value}"`)
  return time
}

function withinBounds(value: string, since: string | undefined, until: string | undefined): boolean {
  let time = Date.parse(value)
  if (since && time < parseTime(since)!) return false
  if (until && time >= parseTime(until)!) return false
  return true
}

export async function listShopifyOrders(params: {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  verbose: boolean
}): Promise<UnifiedRecord[]> {
  let { token } = shopifyClient(params.account, params.verbose)
  let out: UnifiedRecord[] = []
  let after: string | undefined = undefined

  while (out.length < params.maxResults) {
    let data: ShopifyOrdersResponse = await shopifyGraphql<ShopifyOrdersResponse>({
      shop: token.shop,
      accessToken: token.access_token,
      query: ORDERS_QUERY,
      variables: {
        first: Math.min(50, params.maxResults - out.length),
        after,
        query: params.query || undefined,
      },
      verbose: params.verbose,
    })

    for (let order of data.orders.nodes) {
      if (!withinBounds(order.createdAt, params.since, params.until)) continue
      out.push(toUnifiedRecord(order, params.account, token.shop))
      if (out.length >= params.maxResults) break
    }

    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break
    after = data.orders.pageInfo.endCursor
  }

  return out
}
