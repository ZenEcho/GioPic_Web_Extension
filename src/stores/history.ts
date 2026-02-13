/**
 * @file history.ts
 * @description 上传历史记录状态管理 Store
 * 
 * 职责：
 * 1. 管理图片上传的历史记录
 * 2. 持久化历史记录到 IndexedDB
 * 
 * 依赖：
 * - pinia: 状态管理
 * - @/utils/storage: IndexedDB 工具
 * - @/types: 类型定义
 */

import { defineStore } from 'pinia'
import { shallowRef, triggerRef, toRaw } from 'vue'
import type { UploadRecord } from '@/types'
import { db } from '@/utils/storage'

const STORAGE_KEY = 'giopic-history'

/**
 * History Store
 * 管理上传历史记录
 */
export const useHistoryStore = defineStore('history', () => {
  // 使用 shallowRef 优化性能，避免 Vue 深度监听数万条记录
  // 仅监听数组本身的赋值操作，不监听内部对象的变化
  const history = shallowRef<UploadRecord[]>([])

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

  // 防抖保存，避免频繁写入 IndexedDB 导致卡顿
  let saveTimer: any = null
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
        try {
            // 使用 shallowRef 后，history.value 内部为普通对象，无需手动 map 序列化
            // toRaw 确保获取原始数组，虽然 shallowRef.value 已经是原始数组（除非被其他 reactive 包裹）
            await db.set(STORAGE_KEY, toRaw(history.value))
        } catch (e) {
            console.error('Failed to save history to db', e)
        }
    }, 1000) // 延迟 1 秒保存
  }

  /**
   * 添加一条新的上传记录
   * 新记录插入到列表头部
   * 
   * @param record - 上传记录对象
   */
  function addRecord(record: UploadRecord) {
    // shallowRef 不会监听 push/unshift，需要重新赋值或手动触发
    history.value.unshift(record)
    triggerRef(history)
    scheduleSave()
  }

  /**
   * 清空所有历史记录
   */
  function clearHistory() {
    history.value = []
    scheduleSave()
  }

  /**
   * 删除指定的单条历史记录
   * @param id - 记录 ID
   */
  function removeRecord(id: string) {
    history.value = history.value.filter(r => r.id !== id)
    scheduleSave()
  }

  /**
   * 批量删除历史记录
   * 优化：使用 Set 提高查找效率，从 O(M*N) 降低到 O(M)
   * @param ids - 待删除的记录 ID 数组
   */
  function removeRecords(ids: string[]) {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    
    // 如果删除数量很大（超过总量的 50%），使用反向构建可能更快，但 filter + Set 足够通用且高效
    history.value = history.value.filter(r => !idSet.has(r.id))
    scheduleSave()
  }

  /**
   * 批量添加历史记录
   * @param records - 记录数组
   */
  function batchAddRecords(records: UploadRecord[]) {
    if (records.length === 0) return
    
    // 使用 concat 或 spread 构造新数组，一次性赋值
    history.value = [...records, ...history.value]
    scheduleSave()
  }

  return {
    history,
    addRecord,
    batchAddRecords,
    clearHistory,
    removeRecord,
    removeRecords,
    loadHistory
  }
})
