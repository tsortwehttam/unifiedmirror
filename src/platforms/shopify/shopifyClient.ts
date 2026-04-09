import fs from "node:fs"
import { URLSearchParams } from "node:url"
import { resolveTokenReadPathsForAccount } from "../../config/CliConfig"
import { getShopifyCredentialsFromEnv, getShopifyTokenFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

export type ShopifyTokenFile = {
  shop: string
  access_token: string
}

type ShopifyCredentials = {
  shop: string
  client_id: string
  client_secret: string
}

type ShopifyGraphqlError = {
  message: string
}

type CachedShopifyToken = {
  accessToken: string
  expiresAt: number
}

let tokenCache = new Map<string, CachedShopifyToken>()

export function loadShopifyTokenFile(account: string): ShopifyTokenFile | undefined {
  let envToken = getShopifyTokenFromEnv()
  if (envToken) return envToken

  let tokenPath = resolveTokenReadPathsForAccount(account, "shopify").find(value => fs.existsSync(value))
  if (!tokenPath) return undefined
  let raw = JSON.parse(fs.readFileSync(tokenPath, "utf8"))
  if (!raw.shop || !raw.access_token) {
    throw new Error(`Token file for "${account}" is missing shop or access_token`)
  }
  return raw as ShopifyTokenFile
}

async function getShopifyAccessToken(credentials: ShopifyCredentials, verbose: boolean): Promise<string> {
  let key = `${credentials.shop}:${credentials.client_id}`
  let cached = tokenCache.get(key)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.accessToken

  let url = `https://${credentials.shop}/admin/oauth/access_token`
  verboseLog(verbose, "shopify oauth", { url, shop: credentials.shop })
  let response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    }),
  })
  if (!response.ok) {
    let body = await response.text()
    throw new Error(`Shopify token request ${response.status}: ${body}`)
  }
  let body = (await response.json()) as { access_token: string | undefined; expires_in: number | undefined }
  if (!body.access_token || !body.expires_in) throw new Error("Shopify token response missing access_token or expires_in")
  tokenCache.set(key, {
    accessToken: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  })
  return body.access_token
}

export async function shopifyClient(account: string, verbose = false): Promise<{ token: ShopifyTokenFile }> {
  let token = loadShopifyTokenFile(account)
  if (!token) {
    let credentials = getShopifyCredentialsFromEnv()
    if (!credentials) {
      throw new Error(`No Shopify credentials found for "${account}"`)
    }
    token = {
      shop: credentials.shop,
      access_token: await getShopifyAccessToken(credentials, verbose),
    }
  }
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
  let url = `https://${params.shop}/admin/api/2026-04/graphql.json`
  verboseLog(params.verbose, "shopify graphql", { url, variables: params.variables })
  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
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
