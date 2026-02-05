/**
 * @file pluginCore.ts
 * @description 插件核心逻辑处理工具
 * 
 * 职责：
 * 1. 验证插件格式的合法性
 * 2. 处理插件的安装、卸载和状态切换逻辑（Storage 操作）
 * 3. 广播插件更新消息给 Extension 各个部分（Background, Content Scripts）
 * 
 * 依赖：
 * - @/utils/storage: IndexedDB 工具
 * - webextension-polyfill: 浏览器扩展 API
 */

import { db } from '@/utils/storage'
import type { PluginMeta } from '@/types'
import browser from 'webextension-polyfill'

/**
 * 验证插件对象的必要字段
 * 
 * @param plugin - 待验证的插件对象
 * @returns 验证结果对象，包含 valid 标志和 error 消息
 */
export function validatePlugin(plugin: any): { valid: boolean; error?: string } {
    if (!plugin) return { valid: false, error: 'Plugin is empty' }
    if (!plugin.id) return { valid: false, error: 'Missing plugin ID' }
    if (!plugin.name) return { valid: false, error: 'Missing plugin name' }
    if (!plugin.version) return { valid: false, error: 'Missing plugin version' }
    if (!plugin.script) return { valid: false, error: 'Missing plugin script' }
    return { valid: true }
}

/**
 * 广播插件更新消息
 * 通知 Runtime 和所有 Tabs 刷新插件列表
 */
export async function broadcastPluginUpdate() {
    // 1. Notify Extension Pages
    try {
        await browser.runtime.sendMessage({ type: 'REFRESH_PLUGINS' })
    } catch {}

    // 2. Notify Content Scripts
    try {
        const tabs = await browser.tabs.query({})
        for (const tab of tabs) {
            if (tab.id) {
                browser.tabs.sendMessage(tab.id, { type: 'REFRESH_PLUGINS' }).catch(() => {})
            }
        }
    } catch {}
}

/**
 * 安装插件到存储
 * 如果插件已存在则更新，安装后自动启用并广播更新
 * 
 * @param plugin - 插件元数据
 */
export async function installPluginToStorage(plugin: PluginMeta): Promise<void> {
    const stored = await db.get<PluginMeta[]>('plugins')
    const plugins = stored || []
    const index = plugins.findIndex(p => p.id === plugin.id)
    
    const newPlugin = { ...plugin, enabled: true }

    if (index > -1) {
        plugins[index] = newPlugin
    } else {
        plugins.push(newPlugin)
    }
    await db.set('plugins', plugins)
    await broadcastPluginUpdate()
}

/**
 * 从存储中卸载插件
 * 
 * @param pluginId - 待卸载的插件 ID
 * @returns 如果成功删除返回 true，如果未找到返回 false
 */
export async function uninstallPluginFromStorage(pluginId: string): Promise<boolean> {
    const stored = await db.get<PluginMeta[]>('plugins')
    let plugins = stored || []
    const initialLength = plugins.length
    plugins = plugins.filter(p => p.id !== pluginId)
    
    if (plugins.length === initialLength) {
        return false
    }

    await db.set('plugins', plugins)
    await broadcastPluginUpdate()
    return true
}

/**
 * 切换插件的启用/禁用状态
 * 
 * @param pluginId - 插件 ID
 * @param enabled - 目标状态
 * @returns 操作是否成功
 */
export async function togglePluginInStorage(pluginId: string, enabled: boolean): Promise<boolean> {
    const stored = await db.get<PluginMeta[]>('plugins')
    const plugins = stored || []
    const plugin = plugins.find(p => p.id === pluginId)
    if (plugin) {
        plugin.enabled = enabled
        await db.set('plugins', plugins)
        await broadcastPluginUpdate()
        return true
    }
    return false
}
