import { db } from '@/utils/storage'
import type { PluginMeta } from '@/types'
import browser from 'webextension-polyfill'

export function validatePlugin(plugin: any): { valid: boolean; error?: string } {
    if (!plugin) return { valid: false, error: 'Plugin is empty' }
    if (!plugin.id) return { valid: false, error: 'Missing plugin ID' }
    if (!plugin.name) return { valid: false, error: 'Missing plugin name' }
    if (!plugin.version) return { valid: false, error: 'Missing plugin version' }
    if (!plugin.script) return { valid: false, error: 'Missing plugin script' }
    return { valid: true }
}

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
