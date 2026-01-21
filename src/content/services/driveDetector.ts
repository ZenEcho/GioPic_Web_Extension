
export type DetectorType = 'lsky' | 'lskyOpen' | 'easyimages' | 'chevereto' | '16best' | 'Zpic'

export interface DetectionResult {
  type: DetectorType
  version?: 'v1' | 'v2'
}

const getCurrentDomain = () => window.location.hostname

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

export const detectors = {
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

  chevereto: (): DetectionResult | null => {
    const hasGenerator = document.querySelector('meta[name="generator"][content^="Chevereto"]') !== null
    if (hasGenerator) {
      if (!isIgnored()) {
        return { type: 'chevereto' }
      }
    }
    return null
  },

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
}

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

  return null
}
