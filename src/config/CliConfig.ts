import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Platform } from "../types"

export const DEFAULT_ACCOUNT = "default"
export const DEFAULT_CONFIG_DIRNAME = ".um"
export const LEGACY_CONFIG_DIRNAME = ".msgmon"
export const TOKEN_FILE_EXTENSION = ".json"
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
]

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

let cwdConfigDir = path.resolve(process.cwd(), DEFAULT_CONFIG_DIRNAME)
let explicitConfigRoots: string[] = []

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map(value => path.resolve(value))))
}

function getConfiguredRoot(): string | undefined {
  let envRoot = process.env.UM_CONFIG_DIR?.trim()
  if (envRoot) return path.resolve(envRoot)
  return undefined
}

function getDefaultRoots(dirname: string): string[] {
  return [
    path.resolve(path.dirname(cwdConfigDir), dirname),
    path.resolve(APP_DIR, dirname),
    path.resolve(os.homedir(), dirname),
  ]
}

export function setPwdConfigDir(dir: string): void {
  cwdConfigDir = path.resolve(dir)
}

export function prependConfigDir(dir: string): void {
  explicitConfigRoots.unshift(path.resolve(dir))
}

export function removePrependedConfigDir(dir: string): void {
  let resolved = path.resolve(dir)
  explicitConfigRoots = explicitConfigRoots.filter(value => value !== resolved)
}

export function resolveConfigDirs(): string[] {
  let configured = getConfiguredRoot()
  let preferred = configured ? [configured] : []
  return dedupe([
    ...explicitConfigRoots,
    ...preferred,
    ...getDefaultRoots(DEFAULT_CONFIG_DIRNAME),
    ...getDefaultRoots(LEGACY_CONFIG_DIRNAME),
  ])
}

export function resolveWriteConfigDir(): string {
  let configured = getConfiguredRoot()
  if (configured) return configured
  return cwdConfigDir
}

function resolvePlatformCredentialsPaths(platform: Platform): string[] {
  return resolveConfigDirs().map(dir => path.resolve(dir, platform, "credentials.json"))
}

function resolvePlatformTokenDirs(platform: Platform): string[] {
  return resolveConfigDirs().map(dir => path.resolve(dir, platform, "tokens"))
}

export function resolveCredentialsPaths(platform: Platform): string[] {
  return dedupe(resolvePlatformCredentialsPaths(platform))
}

export function resolveCredentialsPath(platform: Platform): string {
  let paths = resolveCredentialsPaths(platform)
  return paths.find(value => fs.existsSync(value)) ?? paths[0]
}

export function resolveAllTokenDirs(platform: Platform): string[] {
  return dedupe(resolvePlatformTokenDirs(platform))
}

export function resolveTokenReadPathsForAccount(account: string, platform: Platform): string[] {
  return resolveAllTokenDirs(platform).map(dir => path.resolve(dir, `${account}${TOKEN_FILE_EXTENSION}`))
}

export function resolveTokenReadPathForAccount(account: string, platform: Platform): string {
  let paths = resolveTokenReadPathsForAccount(account, platform)
  let found = paths.find(value => fs.existsSync(value))
  if (!found) {
    throw new Error(`Missing token for account "${account}". Checked: ${paths.join(", ")}`)
  }
  return found
}

export function resolveTokenWriteDir(platform: Platform): string {
  return path.resolve(resolveWriteConfigDir(), platform, "tokens")
}

export function resolveTokenWritePathForAccount(account: string, platform: Platform): string {
  return path.resolve(resolveTokenWriteDir(platform), `${account}${TOKEN_FILE_EXTENSION}`)
}
