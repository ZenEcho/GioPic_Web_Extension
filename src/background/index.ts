/**
 * @file index.ts
 * @description Background Service Worker 入口文件
 * 
 * 职责：
 * 1. 注册扩展生命周期事件（安装、启动）
 * 2. 初始化核心服务（右键菜单、桌面连接、Token 监控）
 * 3. 处理 Side Panel 的行为与状态同步
 * 4. 处理扩展图标（Action）的点击行为
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 * - ./services/*: 各个业务服务模块
 */

import './polyfill'
import browser from 'webextension-polyfill'
import { setupContextMenus } from './services/contextMenu'
import { getOpenMode, updateActionBehavior } from './services/actionManager'
import { handleMessage, startAuthTokenMonitor } from './services/messageService'
import { initDesktopLinkOnStartup } from './services/desktopLink'
import { getDefaultSettings } from '../constants/defaultSettings'

const POPUP_URL = 'index.html'
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'
const SIDE_PANEL_PATH = 'index.html'


// 初始化
updateActionBehavior()
setupContextMenus()
initDesktopLinkOnStartup()
startAuthTokenMonitor()

// 注册消息处理中心
browser.runtime.onMessage.addListener(handleMessage)

// Side Panel 行为配置（Chrome 特有）
const chromeSidePanel = (globalThis as any).chrome?.sidePanel
if (chromeSidePanel?.setPanelBehavior) {
    // 禁用点击 Action 图标自动打开 Side Panel，由代码控制
    chromeSidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e: any) => {
        console.error('GioPic: setPanelBehavior failed', e)
    })
}

if (chromeSidePanel?.setOptions) {
    // 监听 Tab 更新，确保 Side Panel 在合适的页面可用
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!tab?.url) return
        if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return
        if (changeInfo.status && changeInfo.status !== 'loading' && changeInfo.status !== 'complete') return
        chromeSidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true }).catch((e: any) => {
            console.error('GioPic: sidePanel.setOptions failed', e)
        })
    })
}

/**
 * 同步 Side Panel 开启状态到 storage
 * @param tabId - 标签页 ID
 * @param open - 是否开启
 */
async function setSidePanelOpenState(tabId: number, open: boolean) {
    try {
        const prev = await browser.storage.local.get(SIDE_PANEL_STATE_KEY)
        const current = prev[SIDE_PANEL_STATE_KEY] as Record<string, boolean> | undefined
        const next = { ...(current && typeof current === 'object' ? current : {}) }
        next[String(tabId)] = open
        await browser.storage.local.set({ [SIDE_PANEL_STATE_KEY]: next })
    } catch (e) {
        console.error('GioPic: setSidePanelOpenState failed', e)
    }
}

// 监听 Side Panel 打开事件
if (chromeSidePanel?.onOpened?.addListener) {
    chromeSidePanel.onOpened.addListener((info: any) => {
        const tabId = info?.tabId
        if (typeof tabId === 'number') setSidePanelOpenState(tabId, true)
    })
}

// 监听 Side Panel 关闭事件（部分浏览器支持）
if (chromeSidePanel?.onClosed?.addListener) {
    chromeSidePanel.onClosed.addListener((info: any) => {
        const tabId = info?.tabId
        if (typeof tabId === 'number') setSidePanelOpenState(tabId, false)
    })
}

// 处理非弹窗模式下的点击事件（Tab 或 Window 模式）
browser.action.onClicked.addListener(async (tab) => {
    const mode = await getOpenMode()
    if (mode === 'tab') {
        browser.tabs.create({ url: POPUP_URL })
    } else if (mode === 'window') {
        browser.windows.create({
            type: "popup",
            url: POPUP_URL,
            width: 1280,
            height: 800
        })
    }
})

// 安装事件处理
browser.runtime.onInstalled.addListener(async (details) => {
    console.log('GioPic installed')
    setupContextMenus()

    if (details.reason === 'install') {
        await browser.storage.local.set(getDefaultSettings())
    }
})

// 启动事件处理
browser.runtime.onStartup.addListener(() => {
    setupContextMenus()
})
