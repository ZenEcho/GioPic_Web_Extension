/**
 * @file index.ts
 * @description Background Service Worker 入口文件
 */

import './polyfill'
import browser from 'webextension-polyfill'
import { setupContextMenus } from './services/contextMenu'
import { getOpenMode, updateActionBehavior } from './services/actionManager'
import { handleMessage, startAuthTokenMonitor } from './services/messageService'
import { getDefaultSettings } from '../constants/defaultSettings'
import { BUNDLED_PLUGIN_MIGRATION_KEY, BUNDLED_PLUGINS } from '@/constants/bundledPlugins'
import { seedBundledPluginsOnce } from '@/utils/pluginCore'

const POPUP_URL = 'index.html'
const SIDE_PANEL_STATE_KEY = 'giopic-sidepanel-open-tabs'
const SIDE_PANEL_PATH = 'index.html'

updateActionBehavior()
setupContextMenus()
startAuthTokenMonitor()
void seedBundledPluginsOnce(BUNDLED_PLUGINS, BUNDLED_PLUGIN_MIGRATION_KEY)

browser.runtime.onMessage.addListener(handleMessage)

const chromeSidePanel = (globalThis as any).chrome?.sidePanel
if (chromeSidePanel?.setPanelBehavior) {
  chromeSidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error: any) => {
    console.error('GioPic: setPanelBehavior failed', error)
  })
}

if (chromeSidePanel?.setOptions) {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab?.url) {
      return
    }
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      return
    }
    if (changeInfo.status && changeInfo.status !== 'loading' && changeInfo.status !== 'complete') {
      return
    }
    chromeSidePanel.setOptions({ tabId, path: SIDE_PANEL_PATH, enabled: true }).catch((error: any) => {
      console.error('GioPic: sidePanel.setOptions failed', error)
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
  } catch (error) {
    console.error('GioPic: setSidePanelOpenState failed', error)
  }
}

if (chromeSidePanel?.onOpened?.addListener) {
  chromeSidePanel.onOpened.addListener((info: any) => {
    const tabId = info?.tabId
    if (typeof tabId === 'number') {
      void setSidePanelOpenState(tabId, true)
    }
  })
}

if (chromeSidePanel?.onClosed?.addListener) {
  chromeSidePanel.onClosed.addListener((info: any) => {
    const tabId = info?.tabId
    if (typeof tabId === 'number') {
      void setSidePanelOpenState(tabId, false)
    }
  })
}

browser.action.onClicked.addListener(async () => {
  const mode = await getOpenMode()
  if (mode === 'tab') {
    browser.tabs.create({ url: POPUP_URL })
  } else if (mode === 'window') {
    browser.windows.create({
      type: 'popup',
      url: POPUP_URL,
      width: 1280,
      height: 800,
    })
  }
})

browser.runtime.onInstalled.addListener(async (details) => {
  console.log('GioPic installed')
  setupContextMenus()

  if (details.reason === 'install') {
    await browser.storage.local.set(getDefaultSettings())
  }

  await seedBundledPluginsOnce(BUNDLED_PLUGINS, BUNDLED_PLUGIN_MIGRATION_KEY)
})

browser.runtime.onStartup.addListener(() => {
  setupContextMenus()
  void seedBundledPluginsOnce(BUNDLED_PLUGINS, BUNDLED_PLUGIN_MIGRATION_KEY)
})
