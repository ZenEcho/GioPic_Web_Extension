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

export function useSidebar(props: SidebarProps, emit: SidebarEmits) {
  const { t } = useI18n()
  const configStore = useConfigStore()
  const dialog = useDialog()
  const message = useMessage()

  const showImportModal = ref(false)
  const importJson = ref('')

  function toggleConfigSelection(id: string) {
    let newIds = [...props.selectedIds]
    if (newIds.includes(id)) {
      newIds = newIds.filter(cid => cid !== id)
    } else {
      newIds.push(id)
    }
    emit('update:selectedIds', newIds)
  }

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

  function handleShare(config: DriveConfig) {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    message.success(t('common.copied'))
  }

  function handleShareAll() {
    navigator.clipboard.writeText(JSON.stringify(configStore.configs, null, 2))
    message.success(t('common.copied'))
  }

  async function handleRefresh() {
    await configStore.reload()
    message.success(t('common.success'))
  }

  function handleImport() {
    showImportModal.value = true
    importJson.value = ''
  }

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
    configStore,
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
