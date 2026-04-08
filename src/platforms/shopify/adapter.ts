import type { PlatformAdapter } from "../../adapters/PlatformAdapter"
import { listShopifyOrders } from "./ShopifySource"
import { parseAccountsCli } from "./accounts"

export const shopifyAdapter: PlatformAdapter = {
  platform: "shopify",
  kinds: ["order"],
  listRecords(params) {
    return listShopifyOrders(params)
  },
  fetchAttachment: undefined,
  parseAccountsCli,
  parseAuthCli: undefined,
  pullOptions: [],
}
