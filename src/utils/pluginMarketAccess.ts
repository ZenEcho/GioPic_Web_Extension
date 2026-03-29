import browser from 'webextension-polyfill'
import {
  DEFAULT_PLUGIN_MARKET_ALLOW_ALL_SITES,
  DEFAULT_PLUGIN_MARKET_AUTHORIZED_SITES,
  PLUGIN_MARKET_ALLOW_ALL_SITES_KEY,
  PLUGIN_MARKET_AUTHORIZED_SITES_KEY,
} from '@/constants/pluginMarketAccess'
import type { PluginMeta, PluginPublicSummary } from '@/types'

function hasExplicitScheme(value: string) {
  return /^https?:\/\//i.test(value)
}

export function normalizePluginMarketAuthorizedSite(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const candidate = hasExplicitScheme(trimmed) ? trimmed : `http://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url.host.toLowerCase()
  } catch {
    return null
  }
}

export function sanitizePluginMarketAuthorizedSites(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(
    value
      .map(item => normalizePluginMarketAuthorizedSite(item))
      .filter((item): item is string => Boolean(item)),
  )).sort()
}

export function normalizePluginMarketAuthorizedSites(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PLUGIN_MARKET_AUTHORIZED_SITES]
  }

  return sanitizePluginMarketAuthorizedSites(value)
}

export async function getPluginMarketAuthorizedSites() {
  const result = await browser.storage.local.get(PLUGIN_MARKET_AUTHORIZED_SITES_KEY)
  return normalizePluginMarketAuthorizedSites(result[PLUGIN_MARKET_AUTHORIZED_SITES_KEY])
}

export function normalizePluginMarketAllowAllSites(value: unknown) {
  if (typeof value !== 'boolean') {
    return DEFAULT_PLUGIN_MARKET_ALLOW_ALL_SITES
  }

  return value
}

export async function getPluginMarketAllowAllSites() {
  const result = await browser.storage.local.get(PLUGIN_MARKET_ALLOW_ALL_SITES_KEY)
  return normalizePluginMarketAllowAllSites(result[PLUGIN_MARKET_ALLOW_ALL_SITES_KEY])
}

export async function savePluginMarketAllowAllSites(enabled: unknown) {
  const normalizedEnabled = normalizePluginMarketAllowAllSites(enabled)
  await browser.storage.local.set({
    [PLUGIN_MARKET_ALLOW_ALL_SITES_KEY]: normalizedEnabled,
  })
  return normalizedEnabled
}

export async function savePluginMarketAuthorizedSites(sites: unknown) {
  const normalizedSites = sanitizePluginMarketAuthorizedSites(sites)
  await browser.storage.local.set({
    [PLUGIN_MARKET_AUTHORIZED_SITES_KEY]: normalizedSites,
  })
  return normalizedSites
}

export function hasPluginMarketFullAccess(origin: string, authorizedSites: string[], allowAllSites = false) {
  if (allowAllSites) {
    return true
  }

  const normalizedOrigin = normalizePluginMarketAuthorizedSite(origin)
  return normalizedOrigin ? authorizedSites.includes(normalizedOrigin) : false
}

export function toPluginPublicSummary(plugin: PluginMeta): PluginPublicSummary {
  return {
    id: plugin.id,
    kind: plugin.kind,
    name: plugin.name,
    version: plugin.version,
    author: plugin.author,
    description: plugin.description,
    icon: plugin.icon,
    homepage: plugin.homepage,
    authorUrl: plugin.authorUrl,
    enabled: plugin.enabled !== false,
  }
}

export function toPluginPublicSummaries(plugins: PluginMeta[]) {
  return plugins.map(toPluginPublicSummary)
}
