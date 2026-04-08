import fs from "node:fs"
import { resolveTokenReadPathForAccount } from "../../config/CliConfig"
import { getShopifyTokenFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

export type ShopifyTokenFile = {
  shop: string
  access_token: string
}

type ShopifyGraphqlError = {
  message: string
}

export function loadShopifyTokenFile(account: string): ShopifyTokenFile {
  let envToken = getShopifyTokenFromEnv()
  if (envToken) return envToken

  let tokenPath = resolveTokenReadPathForAccount(account, "shopify")
  let raw = JSON.parse(fs.readFileSync(tokenPath, "utf8"))
  if (!raw.shop || !raw.access_token) {
    throw new Error(`Token file for "${account}" is missing shop or access_token`)
  }
  return raw as ShopifyTokenFile
}

export function shopifyClient(account: string, verbose = false): { token: ShopifyTokenFile } {
  let token = loadShopifyTokenFile(account)
  verboseLog(verbose, "shopify auth", {
    account,
    shop: token.shop,
    hasAccessToken: !!token.access_token,
  })
  return { token }
}

export async function shopifyGraphql<T>(params: {
  shop: string
  accessToken: string
  query: string
  variables: Record<string, unknown>
  verbose: boolean
}): Promise<T> {
  let url = `https://${params.shop}/admin/api/latest/graphql.json`
  verboseLog(params.verbose, "shopify graphql", { url, variables: params.variables })
  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": params.accessToken,
    },
    body: JSON.stringify({
      query: params.query,
      variables: params.variables,
    }),
  })
  if (!response.ok) {
    let body = await response.text()
    throw new Error(`Shopify API ${response.status}: ${body}`)
  }
  let body = (await response.json()) as { data: T | undefined; errors: ShopifyGraphqlError[] | undefined }
  if (body.errors?.length) {
    throw new Error(`Shopify API error: ${body.errors.map(error => error.message).join("; ")}`)
  }
  if (!body.data) throw new Error("Shopify API returned no data")
  return body.data
}
