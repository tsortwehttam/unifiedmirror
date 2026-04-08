import type { Platform } from "../types"
import type { PlatformAdapter } from "./PlatformAdapter"
import { asanaAdapter } from "../platforms/asana/adapter"
import { gmailAdapter } from "../platforms/gmail/adapter"
import { messagesAdapter } from "../platforms/messages/adapter"
import { shopifyAdapter } from "../platforms/shopify/adapter"
import { slackAdapter } from "../platforms/slack/adapter"

export const PLATFORM_ADAPTERS: Record<Platform, PlatformAdapter> = {
  asana: asanaAdapter,
  gmail: gmailAdapter,
  messages: messagesAdapter,
  shopify: shopifyAdapter,
  slack: slackAdapter,
}

export function getPlatformAdapter(platform: Platform): PlatformAdapter {
  return PLATFORM_ADAPTERS[platform]
}

export function listPlatforms(): Platform[] {
  return Object.keys(PLATFORM_ADAPTERS).sort() as Platform[]
}
