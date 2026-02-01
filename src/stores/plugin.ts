
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PluginMeta } from '@/types'
import { db } from '@/utils/storage'

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginMeta[]>([])

  const loadPlugins = async () => {
    const stored = await db.get<PluginMeta[]>('plugins')
    if (stored) {
      plugins.value = stored
    }
  }

  const addPlugin = async (plugin: PluginMeta) => {
    // Check if exists
    const index = plugins.value.findIndex(p => p.id === plugin.id)
    if (index > -1) {
      plugins.value[index] = { ...plugin, enabled: true }
    } else {
      plugins.value.push({ ...plugin, enabled: true })
    }
    await savePlugins()
  }

  const togglePlugin = async (id: string) => {
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) {
        plugin.enabled = plugin.enabled === undefined ? false : !plugin.enabled
        await savePlugins()
    }
  }

  const removePlugin = async (id: string) => {
    plugins.value = plugins.value.filter(p => p.id !== id)
    await savePlugins()
  }

  const getPlugin = (id: string) => {
    return plugins.value.find(p => p.id === id)
  }

  const savePlugins = async () => {
    // Convert to plain object to avoid DataCloneError with Vue Proxies
    const plainPlugins = JSON.parse(JSON.stringify(plugins.value))
    await db.set('plugins', plainPlugins)
  }

  // Initialize
  loadPlugins()

  return {
    plugins,
    loadPlugins,
    addPlugin,
    removePlugin,
    togglePlugin,
    getPlugin
  }
})
