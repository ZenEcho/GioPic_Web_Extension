
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/utils/storage'
import type { PluginMeta } from '@/types'
import browser from 'webextension-polyfill'
import { installPluginToStorage, uninstallPluginFromStorage, togglePluginInStorage } from '@/utils/pluginCore'

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginMeta[]>([])
  const loading = ref(false)

  const loadPlugins = async () => {
    loading.value = true
    try {
      const stored = await db.get<PluginMeta[]>('plugins')
      plugins.value = stored || []
    } finally {
      loading.value = false
    }
  }

  const addPlugin = async (plugin: PluginMeta) => {
    await installPluginToStorage(plugin)
    await loadPlugins()
  }

  const removePlugin = async (id: string) => {
    await uninstallPluginFromStorage(id)
    await loadPlugins()
  }

  const togglePlugin = async (id: string) => {
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) {
      const newState = plugin.enabled === false ? true : false
      await togglePluginInStorage(id, newState)
      await loadPlugins()
    }
  }

  const getPlugin = (type: string) => {
    // type usually matches plugin.id or we might have a specific type field
    // For now assume type === id
    return plugins.value.find(p => p.id === type && p.enabled !== false)
  }

  // Initial load
  loadPlugins()

  // Listen for external updates
  browser.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'REFRESH_PLUGINS') {
      loadPlugins()
    }
  })

  return {
    plugins,
    loading,
    loadPlugins,
    addPlugin,
    removePlugin,
    togglePlugin,
    getPlugin
  }
})
