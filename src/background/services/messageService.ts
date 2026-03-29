/**
 * @file messageService.ts
 * @description 消息路由与处理服务
 */

import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import { db } from '@/utils/storage'
import { updateActionBehavior } from './actionManager'
import { updateContextMenuLocale } from './contextMenu'
import i18n from '@/i18n'
import type { DriveConfig, PluginMeta } from '@/types'
import { getDesktopLinkStatus, setDesktopLinkEnabled } from './desktopLink'
import {
  installPluginToStorage,
  normalizeStoredPlugins,
  togglePluginInStorage,
  uninstallPluginFromStorage,
  validatePlugin,
} from '@/utils/pluginCore'

const authTokenCache: Record<string, string> = {}
const sidePanelOpenByTab: Record<number, boolean> = {}
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'
const CONFIG_STORAGE_KEY = 'giopic-configs'

async function setSidePanelOpenState(tabId: number, open: boolean) {
  try {
    const prev = await browser.storage.local.get(SIDE_PANEL_STATE_KEY)
    const current = prev[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
    const next = { ...(current && typeof current === 'object' ? current : {}) }
    next[String(tabId)] = open
    await browser.storage.local.set({ [SIDE_PANEL_STATE_KEY]: next })
  } catch {}
}

browser.storage.local.get(SIDE_PANEL_STATE_KEY).then((res) => {
  const raw = res[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const tabId = Number(key)
      if (Number.isFinite(tabId)) {
        sidePanelOpenByTab[tabId] = Boolean(value)
      }
    }
  }
}).catch(() => {})

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') {
    return
  }

  const change = changes[SIDE_PANEL_STATE_KEY]
  if (!change) {
    return
  }

  const raw = change.newValue as Record<string, boolean> | undefined
  for (const key of Object.keys(sidePanelOpenByTab)) {
    delete sidePanelOpenByTab[Number(key)]
  }

  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      const tabId = Number(key)
      if (Number.isFinite(tabId)) {
        sidePanelOpenByTab[tabId] = Boolean(value)
      }
    }
  }
})

interface TokenCaptureRule {
  match: string | RegExp
  header: string
}

const CAPTURE_RULES: TokenCaptureRule[] = [
  { match: '/user/tokens', header: 'authorization' },
]

export function startAuthTokenMonitor() {
  const filter = { urls: ['<all_urls>'] }
  const extraInfoSpec: any[] = ['requestHeaders']
  const webRequest = browser?.webRequest || (globalThis as any).chrome?.webRequest

  if (!webRequest) {
    console.warn('GioPic: webRequest API is not available. Authorization header monitoring is disabled.')
    return
  }

  if (webRequest.onBeforeSendHeaders.hasListener(() => {})) {
    try {
      extraInfoSpec.push('extraHeaders')
    } catch {}
  }

  try {
    webRequest.onBeforeSendHeaders.addListener(
      (details: any) => {
        if (!details.requestHeaders) {
          return
        }

        try {
          const urlStr = details.url
          const urlObj = new URL(urlStr)
          const origin = urlObj.origin

          for (const rule of CAPTURE_RULES) {
            const isMatch = typeof rule.match === 'string'
              ? urlStr.includes(rule.match)
              : rule.match.test(urlStr)

            if (!isMatch) {
              continue
            }

            const targetHeader = details.requestHeaders.find(
              (header: any) => header.name.toLowerCase() === rule.header.toLowerCase(),
            )

            if (targetHeader?.value) {
              authTokenCache[origin] = targetHeader.value
              console.log(`GioPic: Captured ${rule.header} for ${origin} from ${rule.match}`)
            }
            break
          }
        } catch {}
      },
      filter,
      extraInfoSpec,
    )
    console.log('GioPic: Authorization monitor started')
  } catch (error) {
    console.error('GioPic: Failed to start Authorization monitor', error)
  }
}

export async function handleMessage(message: any, sender: Runtime.MessageSender) {
  if (message.type === 'UPDATE_OPEN_MODE') {
    await updateActionBehavior()
  } else if (message.type === 'UPDATE_LOCALE') {
    if (message.lang && (message.lang === 'zh-CN' || message.lang === 'en-US')) {
      i18n.global.locale.value = message.lang
      updateContextMenuLocale()
    }
  } else if (message.type === 'RELAY_UPLOAD_SUCCESS') {
    await relayUploadSuccess(message, sender)
  } else if (message.getXsrfToken === 'getXsrfToken' || message.type === 'GET_XSRF_TOKEN') {
    await handleGetXsrfToken(message, sender)
  } else if (message.type === 'SITE_DETECTOR_MESSAGE') {
    return await handleSiteDetectorMessage(message, sender)
  } else if (message.type === 'ADD_CONFIG') {
    await handleAddConfig(message)
  } else if (message.type === 'FETCH_IMAGE_BLOB') {
    return await handleFetchImageBlob(message)
  } else if (message.type === 'DESKTOP_LINK_GET_STATUS') {
    return getDesktopLinkStatus()
  } else if (message.type === 'DESKTOP_LINK_SET_ENABLED') {
    await setDesktopLinkEnabled(Boolean(message.enabled))
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    return await openSidePanel(sender)
  } else if (message.type === 'CLOSE_SIDE_PANEL') {
    return await closeSidePanel(sender)
  } else if (message.type === 'TOGGLE_SIDE_PANEL') {
    return await toggleSidePanel(sender)
  } else if (message.type === 'INSTALL_PLUGIN') {
    return await handleInstallPlugin(message.plugin)
  } else if (message.type === 'TOGGLE_PLUGIN') {
    return await handleTogglePlugin(message.pluginId, message.enabled)
  } else if (message.type === 'UNINSTALL_PLUGIN') {
    return await handleUninstallPlugin(message.pluginId)
  } else if (message.type === 'GET_INSTALLED_PLUGINS') {
    return await handleGetInstalledPlugins()
  } else if (message.type === 'FORWARD_TO_TAB') {
    return await handleForwardToTab(message.payload)
  }
}

async function handleGetInstalledPlugins() {
  try {
    const stored = await db.get<PluginMeta[]>('plugins')
    return { success: true, plugins: normalizeStoredPlugins(stored) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleTogglePlugin(pluginId: string, enabled: boolean) {
  if (!pluginId) {
    return { success: false, error: 'Invalid plugin ID' }
  }

  try {
    const success = await togglePluginInStorage(pluginId, enabled)
    return success ? { success: true } : { success: false, error: 'Plugin not found' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleUninstallPlugin(pluginId: string) {
  if (!pluginId) {
    return { success: false, error: 'Invalid plugin ID' }
  }

  try {
    const success = await uninstallPluginFromStorage(pluginId)
    return success ? { success: true } : { success: false, error: 'Plugin not found' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleInstallPlugin(plugin: unknown) {
  const validation = validatePlugin(plugin)
  if (!validation.valid || !validation.normalized) {
    return { success: false, error: validation.error }
  }

  try {
    await installPluginToStorage(validation.normalized)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function openSidePanel(sender: Runtime.MessageSender) {
  const tabId = sender.tab?.id
  if (!tabId) {
    return { success: false, error: 'No tab ID found' }
  }

  const chromeSidePanel = (globalThis as any).chrome?.sidePanel
  if (chromeSidePanel?.open) {
    try {
      await chromeSidePanel.open({ tabId })
      sidePanelOpenByTab[tabId] = true
      await setSidePanelOpenState(tabId, true)
      return { success: true }
    } catch (error: any) {
      try {
        const windowId = sender.tab?.windowId
        if (windowId) {
          await chromeSidePanel.open({ windowId })
          sidePanelOpenByTab[tabId] = true
          await setSidePanelOpenState(tabId, true)
          return { success: true }
        }
      } catch {}
      return { success: false, error: error?.message || 'Unknown error' }
    }
  }

  if ((browser as any).sidebarAction?.open) {
    try {
      await (browser as any).sidebarAction.open()
      sidePanelOpenByTab[tabId] = true
      await setSidePanelOpenState(tabId, true)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  }

  return { success: false, error: 'API not supported' }
}

async function closeSidePanel(sender: Runtime.MessageSender) {
  const tabId = sender.tab?.id
  if (!tabId) {
    return { success: false, error: 'No tab ID found' }
  }

  const chromeSidePanel = (globalThis as any).chrome?.sidePanel
  if (chromeSidePanel?.setOptions) {
    try {
      await chromeSidePanel.setOptions({ tabId, enabled: false })
      setTimeout(() => {
        chromeSidePanel.setOptions({ tabId, enabled: true, path: 'index.html' }).catch(() => {})
      }, 100)
      sidePanelOpenByTab[tabId] = false
      await setSidePanelOpenState(tabId, false)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message }
    }
  }

  if ((browser as any).sidebarAction?.close) {
    try {
      await (browser as any).sidebarAction.close()
      sidePanelOpenByTab[tabId] = false
      await setSidePanelOpenState(tabId, false)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message }
    }
  }

  return { success: false, error: 'API not supported' }
}

async function toggleSidePanel(sender: Runtime.MessageSender) {
  const tabId = sender.tab?.id
  if (!tabId) {
    return { success: false, error: 'No tab ID found' }
  }

  return sidePanelOpenByTab[tabId] ? closeSidePanel(sender) : openSidePanel(sender)
}

async function relayUploadSuccess(message: any, sender: Runtime.MessageSender) {
  const senderTabId = sender.tab?.id
  const payload = {
    type: 'UPLOAD_EVENT',
    data: {
      event: 'success',
      id: message.id || 'relay',
      payload: message.payload,
      isOrigin: true,
    },
  }

  if (senderTabId) {
    try {
      await browser.tabs.sendMessage(senderTabId, payload)
    } catch (error) {
      console.warn('Failed to relay upload success to sender tab', error)
    }
    return
  }

  try {
    const store = await browser.storage.local.get('giopic-last-content-tab')
    const lastTabId = store['giopic-last-content-tab'] as number | undefined
    if (lastTabId) {
      await browser.tabs.sendMessage(lastTabId, payload)
      return
    }
  } catch {}

  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  if (tabs[0]?.id) {
    try {
      await browser.tabs.sendMessage(tabs[0].id, payload)
    } catch (error) {
      console.warn('Failed to relay upload success to active tab', error)
    }
  }
}

async function getAuthStateForSender(sender: Runtime.MessageSender) {
  if (!sender.tab?.url) {
    return { success: false, error: 'No active tab URL found' }
  }

  try {
    const url = new URL(sender.tab.url)
    let xsrfToken: string | undefined

    try {
      const cookie = await browser.cookies.get({
        url: sender.tab.url,
        name: 'XSRF-TOKEN',
      })
      if (cookie?.value) {
        xsrfToken = decodeURIComponent(cookie.value)
      }
    } catch {}

    const authorization = authTokenCache[url.origin]
    return {
      success: true,
      data: {
        ...(xsrfToken ? { XSRF_TOKEN: xsrfToken } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleGetXsrfToken(_message: any, sender: Runtime.MessageSender) {
  if (!sender.tab?.id) {
    return
  }

  const result = await getAuthStateForSender(sender)
  if (!result.success || !result.data || Object.keys(result.data).length === 0) {
    return
  }

  try {
    await browser.tabs.sendMessage(sender.tab.id, result.data)
  } catch (error) {
    console.error('GioPic: handleGetXsrfToken failed', error)
  }
}

async function handleSiteDetectorMessage(message: any, sender: Runtime.MessageSender) {
  if (message.messageType === 'GET_AUTH_STATE') {
    return getAuthStateForSender(sender)
  }

  return { success: false, error: `Unsupported site detector message type: ${String(message.messageType)}` }
}

async function handleAddConfig(message: any) {
  const config = message.payload || message.config
  if (!config || !config.type) {
    return { success: false, error: 'Invalid config' }
  }

  try {
    const drives = await db.get<DriveConfig[]>(CONFIG_STORAGE_KEY) || []
    const exists = drives.some(drive =>
      drive.type === config.type
      && (drive as any).apiUrl === config.apiUrl
      && (drive as any).token === config.token,
    )

    if (exists) {
      return { success: true, exists: true }
    }

    if (!config.id) {
      config.id = crypto.randomUUID()
    }

    drives.push(config)
    await db.set(CONFIG_STORAGE_KEY, drives)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleFetchImageBlob(message: any) {
  const url = message.url
  if (!url) {
    return null
  }

  if (url.includes('i.111666.best')) {
    try {
      const ruleId = 111666
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [ruleId],
        addRules: [{
          id: ruleId,
          priority: 1,
          action: {
            type: 'modifyHeaders' as any,
            requestHeaders: [{
              header: 'Referer',
              operation: 'set' as any,
              value: url,
            }],
          },
          condition: {
            urlFilter: url,
            resourceTypes: ['xmlhttprequest', 'other', 'image'] as any,
          },
        }],
      })
    } catch (error) {
      console.error('Failed to set DNR rules', error)
    }
  }

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const reader = new FileReader()
    return await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Fetch failed', error)
    return null
  }
}

async function handleForwardToTab(payload: any) {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await browser.tabs.sendMessage(tabs[0].id, payload)
      return { success: true }
    }

    return { success: false, error: 'No active tab found' }
  } catch (error: any) {
    console.error('Forward to tab failed', error)
    return { success: false, error: error?.message || 'Unknown error' }
  }
}
