/**
 * @file notificationService.ts
 * @description 系统通知服务
 * 
 * 职责：
 * 1. 提供发送系统通知的能力
 * 2. 优先尝试在当前 Tab 页面内显示 Toast 通知
 * 3. 降级策略：如果页面通知失败，则使用浏览器原生 Notification API
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 */

import browser from 'webextension-polyfill'

/**
 * 发送通知
 * 优先使用 Content Script 注入的 Toast，失败则回退到系统通知
 * 
 * @param title - 通知标题
 * @param message - 通知内容
 * @param type - 通知类型 ('success' | 'error' | 'info' | 'warning')
 */
export async function notify(title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
        if (tabs.length > 0 && tabs[0]?.id) {
            await browser.tabs.sendMessage(tabs[0]?.id, {
                type: 'SHOW_TOAST',
                data: { title, message, type }
            })
        } else {
            // Fallback to native notification
            browser.notifications.create({
                type: 'basic',
                iconUrl: browser.runtime.getURL('assets/icons/logo64.png'),
                title,
                message
            })
        }
    } catch (e) {
        // Fallback to native notification if content script not available
        browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('assets/icons/logo64.png'),
            title,
            message
        })
    }
}
