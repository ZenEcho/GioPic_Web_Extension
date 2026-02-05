/**
 * @file history.ts
 * @description 上传历史记录状态管理 Store
 * 
 * 职责：
 * 1. 管理图片上传的历史记录
 * 2. 限制历史记录的最大数量（目前限制为 1000 条）
 * 3. 持久化历史记录到 IndexedDB
 * 
 * 依赖：
 * - pinia: 状态管理
 * - @/utils/storage: IndexedDB 工具
 * - @/types: 类型定义
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { UploadRecord } from '@/types'
import { db } from '@/utils/storage'

const STORAGE_KEY = 'giopic-history'

/**
 * History Store
 * 管理上传历史记录
 */
export const useHistoryStore = defineStore('history', () => {
  const history = ref<UploadRecord[]>([])

  /**
   * 初始化加载历史记录
   * 从 IndexedDB 读取数据
   */
  async function loadHistory() {
    try {
      const stored = await db.get<UploadRecord[]>(STORAGE_KEY)
      if (stored) {
        history.value = stored
      }
    } catch (e) {
      console.error('Failed to load history from db', e)
    }
  }

  loadHistory()

  // 监听变化保存
  // 当历史记录变化时，自动同步到 IndexedDB
  watch(history, async (newVal) => {
    try {
        await db.set(STORAGE_KEY, JSON.parse(JSON.stringify(newVal)))
    } catch (e) {
        console.error('Failed to save history to db', e)
    }
  }, { deep: true })

  /**
   * 添加一条新的上传记录
   * 新记录插入到列表头部，并维护最大记录数限制
   * 
   * @param record - 上传记录对象
   */
  function addRecord(record: UploadRecord) {
    history.value.unshift(record)
    // 限制历史记录数量，例如 1000 条
    if (history.value.length > 1000) {
      history.value = history.value.slice(0, 1000)
    }
  }

  /**
   * 清空所有历史记录
   */
  function clearHistory() {
    history.value = []
  }

  /**
   * 删除指定的单条历史记录
   * @param id - 记录 ID
   */
  function removeRecord(id: string) {
    history.value = history.value.filter(r => r.id !== id)
  }

  /**
   * 批量删除历史记录
   * @param ids - 待删除的记录 ID 数组
   */
  function removeRecords(ids: string[]) {
    history.value = history.value.filter(r => !ids.includes(r.id))
  }

  return {
    history,
    addRecord,
    clearHistory,
    removeRecord,
    removeRecords,
    loadHistory
  }
})
