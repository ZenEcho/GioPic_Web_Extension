/**
 * @file messageService.ts
 * @description 消息路由与处理服务
 * 
 * 职责：
 * 1. 处理来自 Popup, Content Script 的所有 Runtime 消息
 * 2. 分发请求到具体的业务处理函数（插件管理、Side Panel 控制、配置管理等）
 * 3. 实现 Token 自动抓取（WebRequest 监听）
 * 4. 维护 Side Panel 的状态同步
 * 
 * 依赖：
 * - webextension-polyfill
 * - @/utils/storage
 * - @/utils/pluginCore
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
    validatePlugin,
    installPluginToStorage,
    uninstallPluginFromStorage,
    togglePluginInStorage
} from '@/utils/pluginCore'

const authTokenCache: Record<string, string> = {}
const sidePanelOpenByTab: Record<number, boolean> = {}
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'

/**
 * 同步 Side Panel 状态到本地存储
 * 
 * @param tabId - 标签页 ID
 * @param open - 开启状态
 */
async function setSidePanelOpenState(tabId: number, open: boolean) {
    try {
        const prev = await browser.storage.local.get(SIDE_PANEL_STATE_KEY)
        const current = prev[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
        const next = { ...(current && typeof current === 'object' ? current : {}) }
        next[String(tabId)] = open
        await browser.storage.local.set({ [SIDE_PANEL_STATE_KEY]: next })
    } catch { }
}

// 初始化加载 Side Panel 状态
browser.storage.local.get(SIDE_PANEL_STATE_KEY).then((res) => {
    const raw = res[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
    if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) {
            const tabId = Number(k)
            if (Number.isFinite(tabId)) sidePanelOpenByTab[tabId] = Boolean(v)
        }
    }
}).catch(() => { })

// 监听 Side Panel 状态变化（多窗口/进程同步）
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

/**
 * 启动 Token 自动抓取监控
 * 监听 webRequest.onBeforeSendHeaders，捕获特定 Header
 */
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

/**
 * 统一消息处理入口
 * 
 * @param message - 消息对象
 * @param sender - 发送者信息
 * @returns 处理结果（Promise）
 */
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
        // Firefox 兼容：从没有 browser.tabs 权限的上下文（如 Sidebar）中转消息到当前活动 Tab
        return await handleForwardToTab(message.payload)
    }
}

/**
 * 获取已安装插件列表
 */
async function handleGetInstalledPlugins() {
    try {
        const stored = await db.get<PluginMeta[]>('plugins')
        return { success: true, plugins: stored || [] }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * 切换插件启用/禁用状态
 * @param pluginId - 插件 ID
 * @param enabled - 目标状态
 */
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

/**
 * 卸载插件
 * @param pluginId - 插件 ID
 */
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

/**
 * 安装插件
 * @param plugin - 插件元数据对象
 */
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

/**
 * 打开 Side Panel
 * 优先使用 chrome.sidePanel API，回退使用 sidebarAction
 */
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

/**
 * 关闭 Side Panel
 */
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

/**
 * 切换 Side Panel 状态
 */
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

/**
 * 中转上传成功消息到 Content Script
 * 确保消息能被页面中的脚本接收到
 */
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

/**
 * 获取 Cookie 中的 XSRF-TOKEN 和缓存的 Authorization，并发送回 Content Script
 * DetectorLsky 通过 browser.runtime.onMessage 监听 { XSRF_TOKEN, Authorization } 消息
 */
async function handleGetXsrfToken(message: any, sender: Runtime.MessageSender) {
    if (!sender.tab?.url || !sender.tab?.id) return
    try {
        const url = new URL(sender.tab.url)
        const origin = url.origin

        // 1. 从 Cookie 获取 XSRF-TOKEN
        let xsrfToken: string | undefined
        try {
            const cookie = await browser.cookies.get({
                url: sender.tab.url,
                name: 'XSRF-TOKEN'
            })
            if (cookie?.value) {
                xsrfToken = decodeURIComponent(cookie.value)
            }
        } catch { }

        // 2. 从 authTokenCache 获取 Authorization
        const authorization = authTokenCache[origin]

        // 3. 如果获取到了任一 Token，发送消息到 Content Script
        if (xsrfToken || authorization) {
            const payload: Record<string, string> = {}
            if (xsrfToken) payload.XSRF_TOKEN = xsrfToken
            if (authorization) payload.Authorization = authorization

            await browser.tabs.sendMessage(sender.tab.id, payload)
        }
    } catch (e) {
        console.error('GioPic: handleGetXsrfToken failed', e)
    }
}

/**
 * 添加图床配置
 * 用于一键配置功能
 * 
 * 注意：存储 key 必须与 stores/config.ts 中的 STORAGE_KEY ('giopic-configs') 保持一致
 */
const CONFIG_STORAGE_KEY = 'giopic-configs'

async function handleAddConfig(message: any, sender: Runtime.MessageSender) {
    // 处理一键配置
    // 兼容 payload 和 config 两种字段名
    const config = message.payload || message.config
    if (!config || !config.type) return { success: false, error: 'Invalid config' }

    try {
        const drives = await db.get<DriveConfig[]>(CONFIG_STORAGE_KEY) || []
        // Check duplicate
        const exists = drives.some(d =>
            d.type === config.type &&
            (d as any).apiUrl === config.apiUrl &&
            (d as any).token === config.token
        )

        if (exists) return { success: true, exists: true }

        // 确保配置有唯一 id（BaseConfig 要求 id 字段）
        if (!config.id) {
            config.id = crypto.randomUUID()
        }

        drives.push(config)
        await db.set(CONFIG_STORAGE_KEY, drives)
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * 获取图片 Blob 数据
 * 解决 Content Script 中的跨域限制
 */
async function handleFetchImageBlob(message: any) {
    const url = message.url
    if (!url) return null

    // Add dynamic rule for Referer
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
                            value: url
                        }]
                    },
                    condition: {
                        urlFilter: url,
                        resourceTypes: ['xmlhttprequest', 'other', 'image'] as any
                    }
                }]
            })
        } catch (e) {
            console.error('Failed to set DNR rules', e)
        }
    }

    try {
        const response = await fetch(url)
        const blob = await response.blob()
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch (e) {
        console.error('Fetch failed', e)
        return null
    }
}


/**
 * 转发消息到当前活动 Tab 的 Content Script
 * 解决 Firefox Sidebar 上下文中 browser.tabs 不可用的问题
 * 
 * @param payload - 要转发给 Content Script 的消息对象
 */
async function handleForwardToTab(payload: any) {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
        if (tabs && tabs.length > 0 && tabs[0]?.id) {
            await browser.tabs.sendMessage(tabs[0].id, payload)
            return { success: true }
        }
        return { success: false, error: 'No active tab found' }
    } catch (e: any) {
        console.error('Forward to tab failed', e)
        return { success: false, error: e?.message || 'Unknown error' }
    }
}
