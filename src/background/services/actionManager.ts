/**
 * @file actionManager.ts
 * @description 扩展图标（Action）行为管理器
 * 
 * 职责：
 * 1. 管理用户点击扩展图标时的打开方式（Popup, Tab, Window）
 * 2. 动态设置 browser.action 的 popup 属性
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 */

import browser from 'webextension-polyfill'

const POPUP_URL = 'index.html'

/**
 * 获取当前的打开模式配置
 * 
 * @returns 打开模式字符串 ('tab' | 'window' | 'action')
 */
export async function getOpenMode() {
    const res = await browser.storage.local.get('open-mode')
    return res['open-mode'] || 'tab'
}

/**
 * 更新 Action 图标的点击行为
 * 
 * 如果模式为 'action'，设置 popup 页面，点击直接弹出原生 Popup
 * 如果模式为 'tab' 或 'window'，清除 popup 设置，点击触发 browser.action.onClicked 事件
 */
export async function updateActionBehavior() {
    const mode = await getOpenMode()
    console.log('Updating action behavior to:', mode)
    if (mode === 'action') {
        browser.action.setPopup({ popup: POPUP_URL })
    } else {
        browser.action.setPopup({ popup: '' })
    }
}
