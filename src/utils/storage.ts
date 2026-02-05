/**
 * @file storage.ts
 * @description IndexedDB 封装工具
 * 
 * 职责：
 * 1. 封装 `idb` 库，提供简化的 Key-Value 存储接口
 * 2. 提供基本的 get, set, del, clear, keys 操作
 * 3. 支持从外部数据库读取数据（用于迁移或跨库访问）
 * 
 * 依赖：
 * - idb: IndexedDB Promise 包装库
 */

import { openDB } from 'idb'

const DB_NAME = 'giopic-db'
const STORE_NAME = 'keyval'

// 初始化数据库连接和对象存储
const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE_NAME)
  },
})

/**
 * 数据库操作对象
 */
export const db = {
  /**
   * 获取键值
   * @param key - 键名
   * @returns 对应的值或 undefined
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    return (await dbPromise).get(STORE_NAME, key)
  },

  /**
   * 设置键值
   * @param key - 键名
   * @param val - 值
   */
  async set(key: string, val: any): Promise<void> {
    await (await dbPromise).put(STORE_NAME, val, key)
  },

  /**
   * 删除键值
   * @param key - 键名
   */
  async del(key: string): Promise<void> {
    return (await dbPromise).delete(STORE_NAME, key)
  },

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    return (await dbPromise).clear(STORE_NAME)
  },

  /**
   * 获取所有键名
   * @returns 键名数组
   */
  async keys(): Promise<IDBValidKey[]> {
    return (await dbPromise).getAllKeys(STORE_NAME)
  },

  /**
   * 从外部 IndexedDB 数据库获取数据
   * 用于跨库数据访问
   * 
   * @param dbName - 数据库名称
   * @param storeName - 对象存储名称
   * @returns 所有记录的数组
   */
  async getFromExternal<T = any>(dbName: string, storeName: string): Promise<T[]> {
    try {
      const externalDb = await openDB(dbName)
      return await externalDb.getAll(storeName)
    } catch (error) {
      console.error(`Failed to get data from external DB ${dbName}/${storeName}:`, error)
      return []
    }
  },
}
