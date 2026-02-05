/**
 * @file desktopLink.ts
 * @description 桌面端连接服务
 * 
 * 职责：
 * 1. 管理与 GioPic 桌面端/PWA 的 WebSocket 连接
 * 2. 接收桌面端的上传成功消息，并自动注入到网页
 * 3. 维护连接状态并同步给前端 UI
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 */

import browser from 'webextension-polyfill'

// 桌面端连接状态类型定义
type DesktopLinkStatusType = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error'

// 桌面端连接状态上报给前端的结构
interface DesktopLinkStatusPayload {
    enabled: boolean
    status: DesktopLinkStatusType
    lastError?: string
}

// 是否开启桌面链接的本地存储 key
const DESKTOP_LINK_ENABLED_KEY = 'giopic-desktop-link-enabled'
// 桌面端 WebSocket 服务地址（默认本机端口 26725）
const DESKTOP_WS_URL = 'ws://127.0.0.1:26725/giopic'

// WebSocket 实例与状态缓存
let desktopWs: WebSocket | null = null
let desktopEnabled = false
let desktopStatus: DesktopLinkStatusType = 'disabled'
let desktopLastError: string | undefined

/**
 * 向最近一次注册的内容脚本页面注入 URL
 * 
 * @param url - 图片 URL
 */
async function injectUrlToContent(url: string) {
    try {
        const store = await browser.storage.local.get('giopic-last-content-tab')
        const lastTabId = store['giopic-last-content-tab'] as number | undefined
        if (lastTabId) {
            await browser.tabs.sendMessage(lastTabId, {
                type: 'MANUAL_INJECT',
                payload: { url }
            })
            return
        }
    } catch {}
    // 如果没有记录到 last-content-tab，则回退到当前激活标签页
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs && tabs.length > 0 && tabs[0]?.id) {
        try {
            await browser.tabs.sendMessage(tabs[0].id!, {
                type: 'MANUAL_INJECT',
                payload: { url }
            })
        } catch (e) {
            console.warn('Failed to inject URL to active tab', e)
        }
    }
}

/**
 * 获取当前桌面链接状态
 * 
 * @returns 状态对象
 */
function getDesktopLinkStatus(): DesktopLinkStatusPayload {
    return {
        enabled: desktopEnabled,
        status: desktopEnabled ? desktopStatus : 'disabled',
        lastError: desktopLastError
    }
}

/**
 * 向前端广播当前桌面链接状态
 * 任何监听 `DESKTOP_LINK_STATUS` 消息的页面（popup/content）都会收到
 */
function broadcastDesktopLinkStatus() {
    const payload = getDesktopLinkStatus()
    try {
        browser.runtime.sendMessage({
            type: 'DESKTOP_LINK_STATUS',
            payload
        })
    } catch {}
}

/**
 * 建立或恢复与桌面端的 WebSocket 连接
 * 处理连接生命周期事件（open, close, error, message）
 */
function connectDesktopWebSocket() {
    if (!desktopEnabled) {
        desktopStatus = 'disabled'
        desktopLastError = undefined
        desktopWs = null
        return
    }
    // 已经是连接状态则不重复创建
    if (desktopWs && desktopStatus === 'connected') {
        return
    }
    try {
        desktopStatus = 'connecting'
        desktopLastError = undefined
        broadcastDesktopLinkStatus()
        const ws = new WebSocket(DESKTOP_WS_URL)
        desktopWs = ws
        ws.onopen = () => {
            desktopStatus = 'connected'
            desktopLastError = undefined
            broadcastDesktopLinkStatus()
            // 建连成功后向桌面端发送 hello 消息，携带版本与能力
            const hello = {
                type: 'hello',
                client: 'giopic-extension',
                version: browser.runtime.getManifest().version,
                features: ['autoInsert']
            }
            try {
                ws.send(JSON.stringify(hello))
            } catch {}
        }
        // 连接关闭，按是否仍开启桌面链接来区分状态
        ws.onclose = () => {
            desktopWs = null
            desktopStatus = desktopEnabled ? 'disconnected' : 'disabled'
            broadcastDesktopLinkStatus()
        }
        ws.onerror = () => {
            desktopStatus = 'error'
            desktopLastError = 'WebSocket error'
            broadcastDesktopLinkStatus()
        }
        // 处理桌面端推送的消息，目前只关心 upload_success 事件
        ws.onmessage = async (event) => {
            const raw = event.data
            let data: any
            try {
                if (typeof raw === 'string') {
                    data = JSON.parse(raw)
                } else if (raw instanceof ArrayBuffer) {
                    const text = new TextDecoder().decode(raw)
                    data = JSON.parse(text)
                } else {
                    return
                }
            } catch {
                return
            }
            if (!data || typeof data !== 'object') {
                return
            }
            if (data.type === 'upload_success' && typeof data.url === 'string') {
                await injectUrlToContent(data.url)
            }
        }
    } catch {
        desktopStatus = 'error'
        desktopLastError = 'WebSocket init failed'
        desktopWs = null
        broadcastDesktopLinkStatus()
    }
}

/**
 * 切换桌面链接开关
 * 同时持久化状态到 local storage
 * 
 * @param enabled - 开启或关闭
 */
async function setDesktopLinkEnabled(enabled: boolean) {
    desktopEnabled = enabled
    if (!enabled) {
        desktopStatus = 'disabled'
        desktopLastError = undefined
        if (desktopWs) {
            try {
                desktopWs.close()
            } catch {}
            desktopWs = null
        }
        try {
            await browser.storage.local.set({ [DESKTOP_LINK_ENABLED_KEY]: false })
        } catch {}
        broadcastDesktopLinkStatus()
        return
    }
    try {
        await browser.storage.local.set({ [DESKTOP_LINK_ENABLED_KEY]: true })
    } catch {}
    // 打开开关时尝试建立连接
    connectDesktopWebSocket()
    broadcastDesktopLinkStatus()
}

/**
 * 初始化桌面链接服务
 * 浏览器启动或扩展初始化时调用，恢复上次的开关状态
 */
async function initDesktopLinkOnStartup() {
    try {
        const store = await browser.storage.local.get(DESKTOP_LINK_ENABLED_KEY)
        desktopEnabled = store[DESKTOP_LINK_ENABLED_KEY] === true
    } catch {
        desktopEnabled = false
    }
    
    if (desktopEnabled) { // 启动时如果已开启则尝试连接
        connectDesktopWebSocket() // 启动时尝试连接
    } else {
        desktopStatus = 'disabled'
        desktopLastError = undefined
    }
    broadcastDesktopLinkStatus() // 初始化时广播状态
}

export {
    type DesktopLinkStatusType,
    type DesktopLinkStatusPayload,
    getDesktopLinkStatus,
    setDesktopLinkEnabled,
    initDesktopLinkOnStartup
}
