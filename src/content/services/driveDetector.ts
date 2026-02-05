
/**
 * @file driveDetector.ts
 * @description 图床网站自动识别服务
 * 
 * 职责：
 * 1. 分析当前页面特征，自动识别是否为支持的图床网站
 * 2. 识别图床版本（如 Lsky v1/v2）
 * 3. 辅助配置页面自动填充图床设置
 * 
 * 依赖：
 * - DOM 查询 API
 */

export type DetectorType = 'lsky' | 'lskyOpen' | 'easyimages' | 'chevereto' | '16best' | 'Zpic' | 'cloudflareImg' | 'telegraphImg'

export interface DetectionResult {
  type: DetectorType
  version?: 'v1' | 'v2'
}

const getCurrentDomain = () => window.location.hostname

/**
 * 等待 DOM 元素出现
 * 用于处理单页应用 (SPA) 元素动态加载的情况
 * 
 * @param selector - CSS 选择器
 * @param timeout - 超时时间 (ms)
 * @returns 找到的元素或 null
 */
async function waitForSelector(selector: string, timeout = 2000): Promise<Element | null> {
  const found = document.querySelector(selector)
  if (found) return found
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        clearTimeout(timer)
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })
}

const isIgnored = () => localStorage.getItem(getCurrentDomain()) === 'true'

/**
 * 图床检测器集合
 * 每个检测器负责识别一种特定的图床系统
 */
export const detectors = {
  /**
   * 兰空图床 (Lsky Pro) 检测
   * 识别特征：特定路径 /user/tokens 或页面特定 ID 元素
   */
  lsky: async (): Promise<DetectionResult | null> => {
    const isTokensPage = window.location.pathname === '/user/tokens'
    if (!isTokensPage) return null
    if (isIgnored()) return null

    const lskyv2_giopicToken = await waitForSelector('#lskyv2_giopic', 2200) //兰空v2主题专属
    const tokenCreateEl = await waitForSelector('#token-create', 2200)
    const btnEl = await waitForSelector('.n-card__content .n-button__content', 2200)
    const btnText = btnEl?.textContent?.trim()

    if (tokenCreateEl) {
      return { type: 'lsky', version: 'v1' }
    } else if (btnText === '创建令牌' || lskyv2_giopicToken) {
      return { type: 'lsky', version: 'v2' }
    }
    return null
  },

  /**
   * 兰空图床开源版 (Lsky Open) 检测
   * 识别特征：/dashboard 路径且包含特定仪表盘元素
   */
  lskyOpen: (): DetectionResult | null => {
    const isDashboard = window.location.pathname === '/dashboard'
    const hasCapacity = document.querySelector('#capacity-progress') !== null
    if (isDashboard && hasCapacity) {
      const capacityEl = document.querySelector('#capacity-progress')
      if (capacityEl) {
        const parent = capacityEl.parentElement
        const firstDiv = parent?.querySelector('div')
        if (
          firstDiv &&
          firstDiv.textContent?.includes('仪表盘') &&
          firstDiv.textContent.includes('上传图片') &&
          firstDiv.textContent.includes('画廊') &&
          firstDiv.textContent.includes('接口')
        ) {
          if (!isIgnored()) {
            return { type: 'lskyOpen' }
          }
        }
      }
    }
    return null
  },

  /**
   * EasyImages 检测
   * 识别特征：/admin/admin.inc.php 路径及特定版权链接
   */
  easyimages: (): DetectionResult | null => {
    const isAdmin = window.location.pathname === '/admin/admin.inc.php'
    const hasGrid = document.querySelector('#myDataGrid') !== null
    const hasEasyImage = document.querySelector('a[href="https://png.cm/"]') !== null
    const hasGithub = document.querySelector('a[href="https://github.com/icret/EasyImages2.0"]') !== null

    if (isAdmin && hasGrid && hasEasyImage && hasGithub) {
      if (!isIgnored()) {
        return { type: 'easyimages' }
      }
    }
    return null
  },

  /**
   * Chevereto 检测
   * 识别特征：Meta generator 标签
   */
  chevereto: (): DetectionResult | null => {
    const hasGenerator = document.querySelector('meta[name="generator"][content^="Chevereto"]') !== null
    if (hasGenerator) {
      if (!isIgnored()) {
        return { type: 'chevereto' }
      }
    }
    return null
  },

  /**
   * 16best 图床检测
   * 识别特征：域名匹配
   */
  best16: (): DetectionResult | null => {
    const isDashboard = getCurrentDomain() === '111666.best'
    if (isDashboard) {
      if (!isIgnored()) {
        return { type: '16best' }
      }
    }
    return null
  },
  // Zpic: (): DetectionResult | null => {
  //   const isApiPage = window.location.pathname === '/account/api'
  //   if (isApiPage) {
  //     if (!isIgnored()) {
  //       return { type: 'Zpic' }
  //     }
  //   }
  //   return null
  // },
  /**
   * CloudFlare Images (开源项目) 检测
   * 识别特征：GitHub 链接
   */
  cloudflareImg: (): DetectionResult | null => {
    //  查找结构
    //      <div class="header">
    //       <a href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank" class="">
    //       </a>
    //       <h1 class="title">
    //           <a class="main-title" href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank"></a>
    //       </h1>
    //   </div>
    const target = 'https://github.com/MarSeventh/CloudFlare-ImgBed'
    const titleLink = document.querySelector(`.header h1 .main-title[href="${target}"]`)

    if (titleLink && !isIgnored()) {
      return { type: 'cloudflareImg' }
    }
    return null
  },
  /**
   * Telegraph Image 检测
   * 识别特征：Footer 中的 GitHub 链接
   */
  telegraphImg: (): DetectionResult | null => {
    // <div class="footer" >
    //  基于 <a href="https://github.com/cf-pages/Telegraph-Image" target="_blank">Telegraph</a> 的图片上传工具
    // </div>
    const target = 'https://github.com/cf-pages/Telegraph-Image'
    const link = document.querySelector(`.footer a[href="${target}"]`)

    if (link && !isIgnored()) {
      return { type: 'telegraphImg' }
    }

    return null
  },
}

/**
 * 执行站点检测
 * 按优先级顺序尝试匹配当前页面是否为已知图床
 * 
 * 优先级：Lsky -> LskyOpen -> EasyImages -> Chevereto -> 16best -> CloudFlare -> Telegraph
 * 
 * @returns 检测结果或 null
 */
export async function detectSite(): Promise<DetectionResult | null> {
  // Priority: Lsky -> LskyOpen -> EasyImages -> Chevereto -> 16best
  const lsky = await detectors.lsky()
  if (lsky) return lsky

  const lskyOpen = detectors.lskyOpen()
  if (lskyOpen) return lskyOpen

  const easy = detectors.easyimages()
  if (easy) return easy

  const chev = detectors.chevereto()
  if (chev) return chev

  const best = detectors.best16()
  if (best) return best

  const cloudflareImg = detectors.cloudflareImg()
  if (cloudflareImg) return cloudflareImg

  const telegraphImg = detectors.telegraphImg()
  if (telegraphImg) return telegraphImg

  return null
}
