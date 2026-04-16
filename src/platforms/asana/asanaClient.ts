import fs from "node:fs"
import { resolveTokenReadPathForAccount } from "../../config/CliConfig"
import { getAsanaTokenFromEnv } from "../../config/envCredentials"
import { verboseLog } from "../../Verbose"

export type AsanaTokenFile = {
  pat: string
  workspace_gid: string | undefined
  workspace_name: string | undefined
}

export type AsanaPage<T> = {
  data: T[]
  next_page: { offset: string } | undefined
}

const ASANA_BASE = "https://app.asana.com/api/1.0"

export function loadAsanaTokenFile(account: string): AsanaTokenFile {
  let envToken = getAsanaTokenFromEnv()
  if (envToken) return envToken

  let tokenPath = resolveTokenReadPathForAccount(account, "asana")
  let raw = JSON.parse(fs.readFileSync(tokenPath, "utf8"))
  if (!raw.pat) throw new Error(`Token file for "${account}" is missing pat`)
  return raw as AsanaTokenFile
}

export function asanaClient(account: string, verbose = false): { token: AsanaTokenFile } {
  let token = loadAsanaTokenFile(account)
  verboseLog(verbose, "asana auth", {
    account,
    hasPat: !!token.pat,
    workspaceGid: token.workspace_gid,
  })
  return { token }
}

export async function asanaFetch<T>(
  pat: string,
  path: string,
  params?: Record<string, string>,
  verbose = false,
): Promise<T> {
  let value = await asanaFetchOptional<T>(pat, path, params, [], verbose)
  if (value === undefined) {
    throw new Error(`Asana API request unexpectedly returned no data for ${path}`)
  }
  return value
}

export async function asanaFetchOptional<T>(
  pat: string,
  path: string,
  params: Record<string, string> | undefined,
  skipStatuses: number[],
  verbose = false,
): Promise<T | undefined> {
  let url = new URL(`${ASANA_BASE}${path}`)
  if (params) {
    for (let [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  verboseLog(verbose, "asana request", url.toString())
  let response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${pat}` },
  })
  if (!response.ok) {
    let body = await response.text()
    if (skipStatuses.includes(response.status)) {
      verboseLog(verbose, "asana skip", { path, status: response.status, body })
      return undefined
    }
    throw new Error(`Asana API ${response.status}: ${body}`)
  }
  return response.json()
}

export async function asanaPost<T>(
  pat: string,
  path: string,
  body: Record<string, unknown>,
  verbose = false,
): Promise<T> {
  let url = `${ASANA_BASE}${path}`
  verboseLog(verbose, "asana post", { url, body })
  let response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: body }),
  })
  if (!response.ok) {
    let text = await response.text()
    throw new Error(`Asana API ${response.status}: ${text}`)
  }
  return response.json()
}
