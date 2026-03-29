import axios from 'axios'
import type { PluginMarketplaceEntity, PluginMarketplaceEntry } from '@/types'
import { validatePlugin } from '@/utils/pluginCore'

const DEFAULT_PLUGIN_MARKET_API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:3000/api'
  : 'https://server.fileup.dev/api'

const PLUGIN_MARKET_API_BASE = (
  import.meta.env.VITE_PLUGIN_MARKET_API_BASE_URL as string | undefined
)?.replace(/\/$/, '') || DEFAULT_PLUGIN_MARKET_API_BASE

const pluginMarketplaceClient = axios.create({
  baseURL: PLUGIN_MARKET_API_BASE,
})

function toDownloadCount(value: PluginMarketplaceEntity['downloads']): number {
  if (typeof value === 'bigint') {
    return Number(value)
  }

  const count = Number(value)
  return Number.isFinite(count) ? count : 0
}

function normalizeMarketplaceEntry(plugin: PluginMarketplaceEntity): PluginMarketplaceEntry | null {
  const content = plugin.versions?.[0]?.content
  const validation = validatePlugin(content)
  if (!validation.valid || !validation.normalized) {
    return null
  }

  return {
    id: plugin.id,
    kind: validation.normalized.kind,
    name: plugin.name || validation.normalized.name,
    version: plugin.versions?.[0]?.version || validation.normalized.version,
    description: plugin.description || validation.normalized.description || '',
    icon: plugin.icon || validation.normalized.icon,
    homepage: validation.normalized.homepage,
    authorName: validation.normalized.author || plugin.author?.username || 'Unknown',
    authorAvatar: plugin.author?.avatar || undefined,
    downloads: toDownloadCount(plugin.downloads),
    updatedAt: plugin.updatedAt,
    content,
  }
}

export async function fetchPluginMarketplaceList(): Promise<PluginMarketplaceEntry[]> {
  const response = await pluginMarketplaceClient.get<PluginMarketplaceEntity[]>('/plugins')
  return response.data
    .map(normalizeMarketplaceEntry)
    .filter((plugin): plugin is PluginMarketplaceEntry => Boolean(plugin))
    .sort((left, right) => right.downloads - left.downloads)
}

export async function recordPluginMarketplaceDownload(pluginId: string) {
  await pluginMarketplaceClient.post(`/plugins/${pluginId}/download`)
}
