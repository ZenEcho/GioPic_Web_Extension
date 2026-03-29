/**
 * @file useDriveRegistry.ts
 * @description 图床驱动注册表组合式函数
 *
 * 职责：
 * 1. 聚合内置图床驱动和 uploader 类型插件驱动
 * 2. 提供统一的驱动元数据获取接口
 * 3. 让 site-detector 插件不会误进入上传配置列表
 */

import { computed } from 'vue'
import { DRIVE_REGISTRY, type DriveRegistryItem, type FieldSchema } from '@/constants/driveSchemas'
import { usePluginStore } from '@/stores/plugin'

export function useDriveRegistry() {
  const pluginStore = usePluginStore()

  const registry = computed(() => {
    const combined: Record<string, DriveRegistryItem> = { ...DRIVE_REGISTRY }

    pluginStore.uploaderPlugins.forEach(plugin => {
      if (plugin.enabled === false) {
        return
      }

      const fields: FieldSchema[] = plugin.uploader.inputs.map(input => ({
        key: input.name,
        label: input.label,
        type: input.type,
        required: input.required,
        defaultValue: input.default,
        options: input.options,
        help: input.help,
        placeholder: input.placeholder,
        filterable: input.filterable,
        clearable: input.clearable,
        tag: input.tag,
        multiple: input.multiple,
        visibleWhen: input.visibleWhen,
        disabledWhen: input.disabledWhen,
        dataSource: input.dataSource,
      }))

      combined[plugin.id] = {
        key: plugin.id,
        label: plugin.name,
        icon: plugin.icon || 'i-ph-puzzle-piece',
        color: 'text-purple-600 bg-purple-100',
        darkColor: 'dark:text-purple-300 dark:bg-purple-900/30',
        category: 'plugin',
        fields,
      }
    })

    return combined
  })

  const getDriveSchema = (type: string) => {
    return registry.value[type]?.fields || []
  }

  const getDriveMeta = (type: string) => {
    return registry.value[type]
  }

  return {
    registry,
    getDriveSchema,
    getDriveMeta,
  }
}
