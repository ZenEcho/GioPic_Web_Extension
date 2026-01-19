import browser from 'webextension-polyfill'
import type { Runtime } from 'webextension-polyfill'
import { db } from '@/utils/storage'
import { updateActionBehavior } from './actionManager'
import { updateContextMenuLocale } from './contextMenu'
import i18n from '@/i18n'
import type { DriveConfig } from '@/types'
import { getDesktopLinkStatus, setDesktopLinkEnabled } from './desktopLink'

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
    if (chromeSidePanel?.close) {
        try {
            await chromeSidePanel.close({ tabId })
            sidePanelOpenByTab[tabId] = false
            await setSidePanelOpenState(tabId, false)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e?.message || 'Unknown error' }
        }
    }

    if (chromeSidePanel?.setOptions) {
        try {
            await chromeSidePanel.setOptions({ tabId, enabled: false })
            sidePanelOpenByTab[tabId] = false
            await setSidePanelOpenState(tabId, false)
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e?.message || 'Unknown error' }
        }
    }

    return { success: false, error: 'API not supported' }
}

async function toggleSidePanel(sender: Runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (!tabId) return { success: false, error: 'No tab ID found' }

    if (sidePanelOpenByTab[tabId]) {
        const res = await closeSidePanel(sender)
        if (res?.success) sidePanelOpenByTab[tabId] = false
        return res
    }
    const res = await openSidePanel(sender)
    if (res?.success) sidePanelOpenByTab[tabId] = true
    return res
}

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

async function relayUploadSuccess(message: any, sender: Runtime.MessageSender) {
    const senderTabId = sender.tab?.id
    if (senderTabId) {
        try {
            await browser.tabs.sendMessage(senderTabId, {
                type: 'UPLOAD_EVENT',
                data: {
                    event: 'success',
                    id: message.id || 'relay',
                    payload: message.payload
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
                    payload: message.payload
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
                    payload: message.payload
                }
            })
        } catch (e) {
            console.warn('Failed to relay upload success to active tab', e)
        }
    }
}

async function handleGetXsrfToken(message: any, sender: Runtime.MessageSender) {
    const url = message.url as string
    let xsrfToken = ''
    let authToken = ''
    let authorization = ''
    console.log('Getting cookies for:', url);

    try {
        // 获取该 url 下的所有 cookies，以便调试和查找
        const cookies = await browser.cookies.getAll({ url })
        console.log('Found cookies:', cookies.map(c => `${c.name}=${c.value}`).join('; '))

        // 查找 XSRF Token
        const xsrfTargetNames = ['XSRF-TOKEN', 'XSRF_TOKEN', 'csrf_token', 'csrftoken', 'xsrf-token', '_csrf']
        const xsrfCookie = cookies.find(c =>
            xsrfTargetNames.includes(c.name) ||
            xsrfTargetNames.includes(c.name.toUpperCase()) ||
            c.name.toLowerCase().includes('csrf') ||
            c.name.toLowerCase().includes('xsrf')
        )
        if (xsrfCookie) {
            xsrfToken = decodeURIComponent(xsrfCookie.value)
        } else {
            // 兼容旧逻辑：尝试获取名为 'cookie' 的值作为备选（虽然不太常见）
            const c1 = cookies.find(c => c.name === 'cookie')
            if (c1) xsrfToken = decodeURIComponent(c1.value)
        }

        // 查找 Authorization Token
        // 很多时候 Authorization token 也会存在 Cookie 中，如 access_token, authorization, token 等
        const authTargetNames = ['authorization', 'Authorization', 'access_token', 'auth_token', 'token', 'TOKEN', 'id_token']
        const authCookie = cookies.find(c =>
            authTargetNames.includes(c.name) ||
            c.name.toLowerCase().includes('auth') ||
            c.name.toLowerCase().includes('token')
        )
        if (authCookie) {
            authToken = decodeURIComponent(authCookie.value)
            // 如果取到的是 Bearer Token 但没有前缀，可能需要根据具体情况处理，
            // 但这里只负责原样获取值。
        }

        // 尝试从 Request Header 缓存中获取 Authorization (优先级更高)
        try {
            const origin = new URL(url).origin
            if (authTokenCache[origin]) {
                authorization = authTokenCache[origin]
            }
        } catch (e) {
            console.error('Error parsing URL for auth cache:', e)
        }

    } catch (e) {
        console.error('Failed to get cookies:', e)
    }

    if (sender.tab?.id) {
        try {
            await browser.tabs.sendMessage(sender.tab.id, {
                XSRF_TOKEN: xsrfToken,
                authToken: authToken,
                Authorization: authorization
            })
        } catch (e) {
            console.warn('Failed to send XSRF token to content script', e)
        }
    }
}

async function handleAddConfig(message: any, sender: Runtime.MessageSender) {
    const data = message.payload as Partial<DriveConfig>
    if (!data) return
    const id = `${(data.type || 'lsky')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const defaultName = (() => {
        try {
            const u = sender.tab?.url ? new URL(sender.tab.url) : null
            return u?.hostname || 'GioPic'
        } catch {
            return 'GioPic'
        }
    })()

    const cfg = {
        ...data,
        id,
        name: data.name || defaultName,
        enabled: true,
        type: data.type || 'lsky'
    } as DriveConfig

    try {
        const list = await db.get<DriveConfig[]>('giopic-configs')
        const configs = list || []
        configs.push(cfg)
        await db.set('giopic-configs', configs)

        const selected = (await db.get<string[]>('giopic-selected-ids')) || []
        if (!selected.includes(id)) {
            selected.push(id)
            await db.set('giopic-selected-ids', selected)
        }
    } catch (e) {
        console.error('Failed to add config', e)
    }
}

async function handleRegisterContent(sender: Runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (!tabId) return
    try {
        await browser.storage.local.set({ 'giopic-last-content-tab': tabId })
    } catch { }
}

function broadcastDesktopLinkStatus() {
    const payload = getDesktopLinkStatus()
    try {
        browser.runtime.sendMessage({
            type: 'DESKTOP_LINK_STATUS',
            payload
        })
    } catch { }
}
