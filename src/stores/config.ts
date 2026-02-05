/**
 * @file config.ts
 * @description 图床配置状态管理 Store
 * 
 * 职责：
 * 1. 管理所有图床驱动的配置信息（增删改查）
 * 2. 管理当前选中的图床配置（用于批量上传）
 * 3. 持久化配置数据到 IndexedDB
 * 
 * 依赖：
 * - pinia: 状态管理
 * - @/utils/storage: IndexedDB 工具
 * - @/types: 类型定义
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { DriveConfig } from '@/types'
import { db } from '@/utils/storage'

const STORAGE_KEY = 'giopic-configs'
const SELECTED_IDS_KEY = 'giopic-selected-ids'

/**
 * Config Store
 * 管理图床配置和选中状态
 */
export const useConfigStore = defineStore('config', () => {
  // 图床配置列表
  const configs = ref<DriveConfig[]>([])
  // 当前选中的图床配置 ID 列表
  const selectedIds = ref<string[]>([])

  // 初始化加载
  // 从 IndexedDB 并行加载配置和选中状态
  Promise.all([
    db.get<DriveConfig[]>(STORAGE_KEY),
    db.get<string[]>(SELECTED_IDS_KEY)
  ]).then(([storedConfigs, storedSelection]) => {
    if (storedConfigs) {
      configs.value = storedConfigs
    }
    
    if (storedSelection !== undefined) {
      selectedIds.value = storedSelection
    } else if (configs.value.length > 0) {
      // 如果没有存储选中状态但有配置，默认全选所有配置
      selectedIds.value = configs.value.map(c => c.id)
    }
  }).catch(e => {
    console.error('Failed to load data from db', e)
  })

  // 监听 selectedIds 保存
  // 当选中状态变化时，自动同步到 IndexedDB
  watch(selectedIds, async (newVal) => {
    try {
      await db.set(SELECTED_IDS_KEY, JSON.parse(JSON.stringify(newVal)))
    } catch (e) {
      console.error('Failed to save selectedIds to db', e)
    }
  }, { deep: true })

  // 监听变化保存
  // 当配置列表变化时，自动同步到 IndexedDB
  watch(configs, async (newVal) => {
    // 使用 JSON.parse(JSON.stringify(newVal)) 去除 Vue 的响应式代理，
    // 虽然 idb/structuredClone 通常能处理，但为了安全起见或者避免 Proxy 问题
    try {
        await db.set(STORAGE_KEY, JSON.parse(JSON.stringify(newVal)))
    } catch (e) {
        console.error('Failed to save configs to db', e)
    }
  }, { deep: true })

  /**
   * 添加新的图床配置
   * @param config - 新的图床配置对象
   */
  function addConfig(config: DriveConfig) {
    configs.value.push(config)
  }

  /**
   * 更新图床配置
   * @param id - 待更新的配置 ID
   * @param newConfig - 新的配置对象
   */
  function updateConfig(id: string, newConfig: DriveConfig) {
    const index = configs.value.findIndex(c => c.id === id)
    if (index !== -1) {
      configs.value[index] = newConfig
    }
  }

  /**
   * 删除图床配置
   * 同时从选中列表中移除该 ID
   * @param id - 待删除的配置 ID
   */
  function removeConfig(id: string) {
    configs.value = configs.value.filter(c => c.id !== id)
    selectedIds.value = selectedIds.value.filter(cid => cid !== id)
  }

  /**
   * 切换图床配置的启用/禁用状态
   * @param id - 配置 ID
   */
  function toggleEnabled(id: string) {
    const config = configs.value.find(c => c.id === id)
    if (config) {
      config.enabled = !config.enabled
    }
  }

  /**
   * 重新从数据库加载配置
   * 用于多窗口或后台更新后的状态同步
   */
  async function reload() {
    try {
      const [storedConfigs, storedSelection] = await Promise.all([
        db.get<DriveConfig[]>(STORAGE_KEY),
        db.get<string[]>(SELECTED_IDS_KEY)
      ])
      configs.value = storedConfigs || []
      if (storedSelection !== undefined) {
        selectedIds.value = storedSelection
      } else if (configs.value.length > 0) {
        selectedIds.value = configs.value.map(c => c.id)
      } else {
        selectedIds.value = []
      }
    } catch (e) {
      console.error('Failed to reload data from db', e)
    }
  }

  return {
    configs,
    selectedIds,
    addConfig,
    updateConfig,
    removeConfig,
    toggleEnabled,
    reload
  }
})
