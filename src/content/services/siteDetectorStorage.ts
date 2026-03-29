import browser from 'webextension-polyfill'

const STORAGE_KEY = 'giopic-site-detector-ignored-hosts'
const pageDismissedKeys = new Set<string>()

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase()
}

function buildIgnoreKey(pluginId: string, hostname: string): string {
  return `${pluginId}@@${normalizeHost(hostname)}`
}

function buildDismissKey(pluginId: string, url: string): string {
  return `${pluginId}@@${url}`
}

async function getIgnoredKeys(): Promise<string[]> {
  const storage = await browser.storage.local.get(STORAGE_KEY)
  return Array.isArray(storage[STORAGE_KEY]) ? storage[STORAGE_KEY] as string[] : []
}

export async function ignoreSiteDetectorHost(pluginId: string, hostname: string): Promise<void> {
  const keys = await getIgnoredKeys()
  const next = new Set(keys)
  next.add(buildIgnoreKey(pluginId, hostname))
  await browser.storage.local.set({ [STORAGE_KEY]: Array.from(next) })
}

export async function isSiteDetectorHostIgnored(pluginId: string, hostname: string): Promise<boolean> {
  const keys = await getIgnoredKeys()
  return keys.includes(buildIgnoreKey(pluginId, hostname))
}

export function dismissSiteDetectorForPage(pluginId: string, url: string): void {
  pageDismissedKeys.add(buildDismissKey(pluginId, url))
}

export function isSiteDetectorDismissedForPage(pluginId: string, url: string): boolean {
  return pageDismissedKeys.has(buildDismissKey(pluginId, url))
}

export function clearDismissedSiteDetectorForPage(pluginId: string, url: string): void {
  pageDismissedKeys.delete(buildDismissKey(pluginId, url))
}
