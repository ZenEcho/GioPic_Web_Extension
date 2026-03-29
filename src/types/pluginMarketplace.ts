import type { PluginKind } from './pluginSchema'

export interface PluginMarketplaceVersion {
  version?: string
  content?: unknown
}

export interface PluginMarketplaceAuthor {
  username?: string
  avatar?: string | null
}

export interface PluginMarketplaceEntity {
  id: string
  authorId?: string
  name?: string
  description?: string
  icon?: string | null
  downloads?: number | string | bigint
  updatedAt?: string
  author?: PluginMarketplaceAuthor
  versions?: PluginMarketplaceVersion[]
}

export interface PluginMarketplaceEntry {
  id: string
  kind: PluginKind
  name: string
  version: string
  description: string
  icon?: string
  homepage?: string
  authorName: string
  authorAvatar?: string
  downloads: number
  updatedAt?: string
  content: unknown
}
