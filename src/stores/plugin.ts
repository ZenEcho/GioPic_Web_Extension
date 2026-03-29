/**
 * @file plugin.ts
 * @description 插件管理状态 Store
 *
 * 职责：
 * 1. 管理已安装的插件列表
 * 2. 处理插件的安装、卸载、启用/禁用
 * 3. 按 kind 暴露 uploader / site-detector / editor-adapter 分类视图
 * 4. 监听插件更新消息并自动刷新
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/utils/storage'
import type { PluginKind, PluginMeta } from '@/types'
import { isEditorAdapterPlugin, isSiteDetectorPlugin, isUploaderPlugin } from '@/types'
import browser from 'webextension-polyfill'
import {
  installPluginToStorage,
  normalizeStoredPlugins,
  uninstallPluginFromStorage,
  togglePluginInStorage,
} from '@/utils/pluginCore'

export const usePluginStore = defineStore('plugin', () => {
  const plugins = ref<PluginMeta[]>([])
  const loading = ref(false)

  const uploaderPlugins = computed(() => plugins.value.filter(isUploaderPlugin))
  const siteDetectorPlugins = computed(() => plugins.value.filter(isSiteDetectorPlugin))
  const editorAdapterPlugins = computed(() => plugins.value.filter(isEditorAdapterPlugin))

  const loadPlugins = async () => {
    loading.value = true
    try {
      const stored = await db.get<PluginMeta[]>('plugins')
      plugins.value = normalizeStoredPlugins(stored)
    } finally {
      loading.value = false
    }
  }

  const addPlugin = async (plugin: unknown) => {
    await installPluginToStorage(plugin)
    await loadPlugins()
  }

  const removePlugin = async (id: string) => {
    await uninstallPluginFromStorage(id)
    await loadPlugins()
  }

  const togglePlugin = async (id: string) => {
    const plugin = plugins.value.find(item => item.id === id)
    if (!plugin) {
      return
    }

    const newState = plugin.enabled === false
    await togglePluginInStorage(id, newState)
    await loadPlugins()
  }

  const getPlugin = (type: string) => {
    return uploaderPlugins.value.find(plugin => plugin.id === type && plugin.enabled !== false)
  }

  const getPluginsByKind = (kind: PluginKind) => {
    return plugins.value.filter(plugin => plugin.kind === kind && plugin.enabled !== false)
  }

  void loadPlugins()

  browser.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'REFRESH_PLUGINS') {
      void loadPlugins()
    }
  })

  return {
    plugins,
    loading,
    uploaderPlugins,
    siteDetectorPlugins,
    editorAdapterPlugins,
    loadPlugins,
    addPlugin,
    removePlugin,
    togglePlugin,
    getPlugin,
    getPluginsByKind,
  }
})
