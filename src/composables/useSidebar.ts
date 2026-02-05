/**
 * @file useSidebar.ts
 * @description 侧边栏交互逻辑组合式函数
 * 
 * 职责：
 * 1. 管理侧边栏中的图床配置列表交互（选中、删除、分享）
 * 2. 处理配置导入功能
 * 3. 触发导航和弹窗事件
 * 
 * 依赖：
 * - vue: 响应式 API
 * - naive-ui: UI 反馈
 * - @/stores/config: 配置 Store
 */

import { ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useI18n } from 'vue-i18n'
import { useDialog, useMessage } from 'naive-ui'
import type { DriveConfig } from '@/types'

export interface SidebarProps {
  selectedIds: string[]
}

export interface SidebarEmits {
  (e: 'update:selectedIds', value: string[]): void
  (e: 'add'): void
  (e: 'edit', config: DriveConfig): void
  (e: 'openSettings'): void
  (e: 'navigate', view: 'upload' | 'history'): void
}

/**
 * 侧边栏逻辑的组合式函数
 * 处理配置的增删改查、导入导出、分享以及导航逻辑
 * 
 * @param props - 组件属性
 * @param emit - 事件触发器
 */
export function useSidebar(props: SidebarProps, emit: SidebarEmits) {
  const { t } = useI18n()
  const configStore = useConfigStore()
  const dialog = useDialog()
  const message = useMessage()

  const showImportModal = ref(false)
  const importJson = ref('')

  /**
   * 切换图床配置的选中状态（多选）
   * 
   * @param id - 配置项 ID
   */
  function toggleConfigSelection(id: string) {
    let newIds = [...props.selectedIds]
    if (newIds.includes(id)) {
      newIds = newIds.filter(cid => cid !== id)
    } else {
      newIds.push(id)
    }
    emit('update:selectedIds', newIds)
  }

  /**
   * 删除图床配置
   * 包含二次确认对话框
   * 
   * @param config - 待删除的配置对象
   */
  function handleDelete(config: DriveConfig) {
    dialog.warning({
      title: t('common.delete'),
      content: t('common.deleteConfirm'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: () => {
        configStore.removeConfig(config.id)
        if (props.selectedIds.includes(config.id)) {
          emit('update:selectedIds', props.selectedIds.filter(id => id !== config.id))
        }
      }
    })
  }

  /**
   * 分享单个配置
   * 将配置内容复制到剪贴板
   * 
   * @param config - 待分享的配置对象
   */
  function handleShare(config: DriveConfig) {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    message.success(t('common.copied'))
  }

  /**
   * 分享所有配置
   * 将所有配置内容复制到剪贴板
   */
  function handleShareAll() {
    navigator.clipboard.writeText(JSON.stringify(configStore.configs, null, 2))
    message.success(t('common.copied'))
  }

  /**
   * 刷新配置
   * 从存储中重新加载配置列表
   */
  async function handleRefresh() {
    await configStore.reload()
    message.success(t('common.success'))
  }

  /**
   * 打开导入配置弹窗
   */
  function handleImport() {
    showImportModal.value = true
    importJson.value = ''
  }

  /**
   * 确认导入配置
   * 解析 JSON 字符串并添加到配置存储中
   * 自动生成新的 ID 以避免冲突
   */
  function confirmImport() {
    try {
      const parsed = JSON.parse(importJson.value)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      let count = 0
      list.forEach(item => {
        if (item && item.type && item.name) {
          // Generate new ID
          const newConfig = {
            ...item,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9)
          }
          configStore.addConfig(newConfig)
          count++
        }
      })
      if (count > 0) {
        message.success(t('home.importSuccess', { count }))
        showImportModal.value = false
      } else {
        message.warning(t('home.importNoData'))
      }
    } catch (e) {
      message.error(t('home.importFailed'))
    }
  }

  return {
    showImportModal,
    importJson,
    toggleConfigSelection,
    handleDelete,
    handleShare,
    handleShareAll,
    handleRefresh,
    handleImport,
    confirmImport
  }
}
