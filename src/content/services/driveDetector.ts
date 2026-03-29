/**
 * @deprecated 旧的硬编码 driveDetector 已迁移到 site-detector 插件 runner。
 * 该文件仅保留轻量兼容适配，供历史调用方过渡。
 */

import { findBestSiteDetector } from './siteDetectorRunner'

export type DetectorType = string

export interface DetectionResult {
  type: DetectorType
  version?: string
  pluginId: string
}

export async function detectSite(): Promise<DetectionResult | null> {
  const match = await findBestSiteDetector()
  if (!match) {
    return null
  }

  return {
    type: match.plugin.id,
    version: typeof match.state?.version === 'string' ? match.state.version : undefined,
    pluginId: match.plugin.id,
  }
}
