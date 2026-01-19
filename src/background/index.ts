import './polyfill'
import browser from 'webextension-polyfill'
import { setupContextMenus } from './services/contextMenu'
import { getOpenMode, updateActionBehavior } from './services/actionManager'
import { handleMessage, startAuthTokenMonitor } from './services/messageService'
import { initDesktopLinkOnStartup } from './services/desktopLink'

const POPUP_URL = 'index.html'
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'
const SIDE_PANEL_PATH = 'index.html'

console.log('GioPic background script started')

// 初始化
updateActionBehavior()
setupContextMenus()
initDesktopLinkOnStartup()
startAuthTokenMonitor()

browser.runtime.onMessage.addListener(handleMessage)

const chromeSidePanel = (globalThis as any).chrome?.sidePanel
if (chromeSidePanel?.setPanelBehavior) {
    chromeSidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((e: any) => {
        console.error('GioPic: setPanelBehavior failed', e)
    })
}

if (chromeSidePanel?.setOptions) {
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (!tab?.url) return
        if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) return
        if (changeInfo.status && changeInfo.status !== 'loading' && changeInfo.status !== 'complete') return
        chromeSidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true }).catch((e: any) => {
            console.error('GioPic: sidePanel.setOptions failed', e)
        })
    })
}

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

if (chromeSidePanel?.onOpened?.addListener) {
    chromeSidePanel.onOpened.addListener((info: any) => {
        const tabId = info?.tabId
        if (typeof tabId === 'number') setSidePanelOpenState(tabId, true)
    })
}

if (chromeSidePanel?.onClosed?.addListener) {
    chromeSidePanel.onClosed.addListener((info: any) => {
        const tabId = info?.tabId
        if (typeof tabId === 'number') setSidePanelOpenState(tabId, false)
    })
}

// 处理非弹窗模式下的点击事件
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
        await browser.storage.local.set({
            'giopic-auto-inject': true,
            'giopic-dark-mode': true,
            'giopic-locale': 'zh-CN',
            'open-mode': 'tab',
            sidebarSettings: {
                enabled: true,
                mode: 'inject',
                opacity: 80,
            },
            sidebar_disabled_sites: []
        })
    }
})

browser.runtime.onStartup.addListener(() => {
    setupContextMenus()
})
