import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import { db } from '@/utils/storage'
import { updateActionBehavior } from './actionManager'
import { updateContextMenuLocale } from './contextMenu'
import i18n from '@/i18n'
import type { DriveConfig, PluginMeta } from '@/types'
import { getDesktopLinkStatus, setDesktopLinkEnabled } from './desktopLink'
import {
    validatePlugin,
    installPluginToStorage,
    uninstallPluginFromStorage,
    togglePluginInStorage
} from '@/utils/pluginCore'

const authTokenCache: Record<string, string> = {}
const sidePanelOpenByTab: Record<number, boolean> = {}
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'

async function setSidePanelOpenState(tabId: number, open: boolean) {
    try {
        const prev = await browser.storage.local.get(SIDE_PANEL_STATE_KEY)
        const current = prev[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
        const next = { ...(current && typeof current === 'object' ? current : {}) }
        next[String(tabId)] = open
        await browser.storage.local.set({ [SIDE_PANEL_STATE_KEY]: next })
    } catch { }
}

browser.storage.local.get(SIDE_PANEL_STATE_KEY).then((res) => {
    const raw = res[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
    if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
            const tabId = Number(k)
            if (Number.isFinite(tabId)) sidePanelOpenByTab[tabId] = Boolean(v)
        }
    }
}).catch(() => { })

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const change = changes[SIDE_PANEL_STATE_KEY]
    if (!change) return
    const raw = change.newValue as Record<string, boolean> | undefined
    for (const k of Object.keys(sidePanelOpenByTab)) delete sidePanelOpenByTab[Number(k)]
    if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
            const tabId = Number(k)
            if (Number.isFinite(tabId)) sidePanelOpenByTab[tabId] = Boolean(v)
        }
    }
})

// 定义抓取规则接口
interface TokenCaptureRule {
    match: string | RegExp; // URL 匹配规则
    header: string;         // 要抓取的 Header 名称（小写）
}

// 通用配置规则列表
// 可以在这里添加更多适配规则
const CAPTURE_RULES: TokenCaptureRule[] = [
    { match: '/user/tokens', header: 'authorization' },
    // 示例：添加更多规则
    // { match: '/api/v1/auth', header: 'x-auth-token' },
]

export function startAuthTokenMonitor() {
    // 监听请求头，捕获 Authorization
    // 注意：需要 'webRequest' 权限和 host 权限
    const filter = { urls: ["<all_urls>"] }
    const extraInfoSpec: any[] = ["requestHeaders"]

    // 兼容处理：优先使用 browser 对象，如果 webRequest 不存在则尝试 chrome 对象
    // 在某些 MV3 环境下，webextension-polyfill 可能未正确暴露 webRequest
    const webRequest = browser?.webRequest || (globalThis as any).chrome?.webRequest

    if (!webRequest) {
        console.warn('GioPic: webRequest API is not available. Authorization header monitoring is disabled.')
        return
    }

    // Chrome MV3 中读取 Authorization 可能需要 extraHeaders
    if (webRequest.onBeforeSendHeaders.hasListener(() => { })) {
        try {
            extraInfoSpec.push('extraHeaders')
        } catch { }
    }

    try {
        webRequest.onBeforeSendHeaders.addListener(
            (details: any) => {
                if (details.requestHeaders) {
                    try {
                        const urlStr = details.url
                        const urlObj = new URL(urlStr)
                        const origin = urlObj.origin

                        // 遍历规则，寻找匹配项
                        for (const rule of CAPTURE_RULES) {
                            const isMatch = typeof rule.match === 'string'
                                ? urlStr.includes(rule.match)
                                : rule.match.test(urlStr)

                            if (isMatch) {
                                const targetHeader = details.requestHeaders.find(
                                    (h: any) => h.name.toLowerCase() === rule.header.toLowerCase()
                                )

                                if (targetHeader && targetHeader.value) {
                                    // 如果该 origin 已经有了一个 Bearer token，且新获取的不是 Bearer，则跳过（避免降级）
                                    // 除非是特定的路径匹配，我们假设规则匹配的优先级较高，或者可以更新 Token
                                    const currentVal = targetHeader.value

                                    // 更新缓存
                                    authTokenCache[origin] = currentVal
                                    console.log(`GioPic: Captured ${rule.header} for ${origin} from ${rule.match}`)
                                }
                                break;
                            }
                        }
                    } catch { }
                }
            },
            filter,
            extraInfoSpec
        )
        console.log('GioPic: Authorization monitor started')
    } catch (e) {
        console.error('GioPic: Failed to start Authorization monitor', e)
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
    } else if (message.type === 'ADD_CONFIG') {
        await handleAddConfig(message, sender)
    } else if (message.type === 'FETCH_IMAGE_BLOB') {
        return await handleFetchImageBlob(message)
    } else if (message.type === 'REGISTER_CONTENT') {
        await handleRegisterContent(sender)
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
    }
}

async function handleGetInstalledPlugins() {
    try {
        const stored = await db.get<PluginMeta[]>('plugins')
        return { success: true, plugins: stored || [] }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function handleTogglePlugin(pluginId: string, enabled: boolean) {
    if (!pluginId) return { success: false, error: 'Invalid plugin ID' }
    try {
        const success = await togglePluginInStorage(pluginId, enabled)
        if (success) return { success: true }
        return { success: false, error: 'Plugin not found' }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function handleUninstallPlugin(pluginId: string) {
    if (!pluginId) return { success: false, error: 'Invalid plugin ID' }
    try {
        const success = await uninstallPluginFromStorage(pluginId)
        if (success) return { success: true }
        return { success: false, error: 'Plugin not found' }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function handleInstallPlugin(plugin: PluginMeta) {
    const validation = validatePlugin(plugin)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    try {
        await installPluginToStorage(plugin)
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function openSidePanel(sender: Runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (!tabId) return { success: false, error: 'No tab ID found' }

    const chromeSidePanel = (globalThis as any).chrome?.sidePanel
    if (chromeSidePanel?.open) {
        try {
            await chromeSidePanel.open({ tabId })
            sidePanelOpenByTab[tabId] = true
            await setSidePanelOpenState(tabId, true)
            return { success: true }
        } catch (e: any) {
            try {
                const windowId = sender.tab?.windowId
                if (windowId) {
                    await chromeSidePanel.open({ windowId })
                    sidePanelOpenByTab[tabId] = true
                    await setSidePanelOpenState(tabId, true)
                    return { success: true }
                }
            } catch { }
            return { success: false, error: e?.message || 'Unknown error' }
        }
    }

    if ((browser as any).sidebarAction?.open) {
        try {
            await (browser as any).sidebarAction.open()
            sidePanelOpenByTab[tabId] = true
            await setSidePanelOpenState(tabId, true)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e?.message || 'Unknown error' }
        }
    }

    return { success: false, error: 'API not supported' }
}

async function closeSidePanel(sender: Runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (!tabId) return { success: false, error: 'No tab ID found' }

    const chromeSidePanel = (globalThis as any).chrome?.sidePanel
    if (chromeSidePanel?.setOptions) {
        try {
            await chromeSidePanel.setOptions({ tabId, enabled: false })
            setTimeout(() => {
                chromeSidePanel.setOptions({ tabId, enabled: true, path: 'index.html' }).catch(() => { })
            }, 100)
            sidePanelOpenByTab[tabId] = false
            await setSidePanelOpenState(tabId, false)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e?.message }
        }
    }

    if ((browser as any).sidebarAction?.close) {
        try {
            await (browser as any).sidebarAction.close()
            sidePanelOpenByTab[tabId] = false
            await setSidePanelOpenState(tabId, false)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e?.message }
        }
    }

    return { success: false, error: 'API not supported' }
}

async function toggleSidePanel(sender: Runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (!tabId) return { success: false, error: 'No tab ID found' }

    // Check if currently open
    const isOpen = sidePanelOpenByTab[tabId] || false
    if (isOpen) {
        return await closeSidePanel(sender)
    } else {
        return await openSidePanel(sender)
    }
}

async function relayUploadSuccess(message: any, sender: Runtime.MessageSender) {
    const senderTabId = sender.tab?.id
    if (senderTabId) {
        try {
            await browser.tabs.sendMessage(senderTabId, {
                type: 'UPLOAD_EVENT',
                data: {
                    event: 'success',
                    id: message.id || 'relay',
                    payload: message.payload,
                    isOrigin: true
                }
            })
        } catch (e) {
            console.warn('Failed to relay upload success to sender tab', e)
        }
        return
    }
    try {
        const store = await browser.storage.local.get('giopic-last-content-tab')
        const lastTabId = store['giopic-last-content-tab'] as number | undefined
        if (lastTabId) {
            await browser.tabs.sendMessage(lastTabId, {
                type: 'UPLOAD_EVENT',
                data: {
                    event: 'success',
                    id: message.id || 'relay',
                    payload: message.payload,
                    isOrigin: true
                }
            })
            return
        }
    } catch { }
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs && tabs.length > 0 && tabs[0]?.id) {
        try {
            await browser.tabs.sendMessage(tabs[0].id!, {
                type: 'UPLOAD_EVENT',
                data: {
                    event: 'success',
                    id: message.id || 'relay',
                    payload: message.payload,
                    isOrigin: true
                }
            })
        } catch (e) {
            console.warn('Failed to relay upload success to active tab', e)
        }
    }
}

async function handleGetXsrfToken(message: any, sender: Runtime.MessageSender) {
    // 简单实现：尝试从 Cookie 中获取 XSRF-TOKEN
    // 注意：需要 'cookies' 权限和 host 权限
    if (!sender.tab?.url) return
    try {
        const url = new URL(sender.tab.url)
        const cookie = await browser.cookies.get({
            url: sender.tab.url,
            name: 'XSRF-TOKEN'
        })
        return cookie?.value
    } catch { return null }
}

async function handleAddConfig(message: any, sender: Runtime.MessageSender) {
    // 处理一键配置
    const { config } = message
    if (!config || !config.type) return { success: false, error: 'Invalid config' }

    try {
        const drives = await db.get<DriveConfig[]>('drives') || []
        // Check duplicate
        const exists = drives.some(d =>
            d.type === config.type &&
            (d as any).apiUrl === config.apiUrl &&
            (d as any).token === config.token
        )

        if (exists) return { success: true, exists: true }

        drives.push(config)
        await db.set('drives', drives)
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function handleFetchImageBlob(message: any) {
    // 代理获取图片 Blob (解决跨域和 Cookie 问题)
    const { url } = message
    if (!url) return { success: false, error: 'No URL' }

    try {
        const res = await fetch(url)
        const blob = await res.blob()
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
        })
        return { success: true, base64, type: blob.type }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function handleRegisterContent(sender: Runtime.MessageSender) {
    // Content Script 注册（暂无特殊操作）
    // console.log('Content script registered:', sender.tab?.id)
}
