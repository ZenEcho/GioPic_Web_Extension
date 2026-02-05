/**
 * @file plugin.ts
 * @description 插件管理状态 Store
 * 
 * 职责：
 * 1. 管理已安装的插件列表
 * 2. 处理插件的安装、卸载、启用/禁用
 * 3. 监听插件更新消息并自动刷新
 * 
 * 依赖：
 * - pinia: 状态管理
 * - @/utils/storage: 数据持久化
 * - @/utils/pluginCore: 插件核心逻辑
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/utils/storage'
import type { PluginMeta } from '@/types'
import browser from 'webextension-polyfill'
import { installPluginToStorage, uninstallPluginFromStorage, togglePluginInStorage } from '@/utils/pluginCore'

/**
 * Plugin Store
 * 管理扩展插件系统
 */
export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginMeta[]>([])
  const loading = ref(false)

  /**
   * 加载插件列表
   * 从 IndexedDB 读取已安装的插件
   */
  const loadPlugins = async () => {
    loading.value = true
    try {
      const stored = await db.get<PluginMeta[]>('plugins')
      plugins.value = stored || []
    } finally {
      loading.value = false
    }
  }

  /**
   * 安装新插件
   * @param plugin - 插件元数据对象
   */
  const addPlugin = async (plugin: PluginMeta) => {
    await installPluginToStorage(plugin)
    await loadPlugins()
  }

  /**
   * 卸载插件
   * @param id - 插件 ID
   */
  const removePlugin = async (id: string) => {
    await uninstallPluginFromStorage(id)
    await loadPlugins()
  }

  /**
   * 切换插件启用状态
   * @param id - 插件 ID
   */
  const togglePlugin = async (id: string) => {
    const plugin = plugins.value.find(p => p.id === id)
    if (plugin) {
      const newState = plugin.enabled === false ? true : false
      await togglePluginInStorage(id, newState)
      await loadPlugins()
    }
  }

  /**
   * 获取指定类型的插件
   * 目前 type 通常等于 plugin.id
   * 
   * @param type - 插件类型标识
   * @returns 插件元数据或 undefined
   */
  const getPlugin = (type: string) => {
    // type usually matches plugin.id or we might have a specific type field
    // For now assume type === id
    return plugins.value.find(p => p.id === type && p.enabled !== false)
  }

  // Initial load
  loadPlugins()

  // Listen for external updates
  // 监听来自 Background 或其他页面的插件刷新消息
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
