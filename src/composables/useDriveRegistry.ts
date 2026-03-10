/**
 * @file useDriveRegistry.ts
 * @description 图床驱动注册表组合式函数
 * 
 * 职责：
 * 1. 聚合内置图床驱动和插件图床驱动
 * 2. 提供统一的驱动元数据获取接口
 * 3. 提供驱动配置 Schema 获取接口
 * 
 * 依赖：
 * - vue: 计算属性
 * - @/constants/driveSchemas: 内置驱动定义
 * - @/stores/plugin: 插件 Store
 */

import { computed } from 'vue'
import { DRIVE_REGISTRY, type DriveRegistryItem, type FieldSchema } from '@/constants/driveSchemas'
import { usePluginStore } from '@/stores/plugin'

/**
 * 图床驱动注册表的组合式函数
 * 负责聚合内置图床驱动和插件提供的图床驱动
 */
export function useDriveRegistry() {
  const pluginStore = usePluginStore()
  
  /**
   * 计算属性：完整的图床驱动注册表
   * 合并了静态定义的内置驱动 (DRIVE_REGISTRY) 和动态加载的插件驱动
   */
  const registry = computed(() => {
    const combined: Record<string, DriveRegistryItem> = { ...DRIVE_REGISTRY }
    
    // Merge plugins
    pluginStore.plugins.forEach(plugin => {
       if (plugin.enabled === false) return // Skip disabled plugins

       // 将插件的输入配置转换为 FieldSchema 格式
       const fields: FieldSchema[] = plugin.inputs.map(input => ({
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
       
       // 构建插件驱动的注册项
       combined[plugin.id] = {
           key: plugin.id,
           label: plugin.name,
           icon: plugin.icon || 'i-ph-puzzle-piece',
           color: 'text-purple-600 bg-purple-100',
           darkColor: 'dark:text-purple-300 dark:bg-purple-900/30',
           category: 'plugin', 
           fields: fields
       }
    })
    
    return combined
  })

  /**
   * 获取指定图床类型的配置表单 Schema
   * 
   * @param type - 图床类型标识符
   * @returns 表单字段配置数组
   */
  const getDriveSchema = (type: string) => {
    return registry.value[type]?.fields || []
  }

  /**
   * 获取指定图床类型的元数据（图标、颜色、标签等）
   * 
   * @param type - 图床类型标识符
   * @returns 图床注册项信息
   */
  const getDriveMeta = (type: string) => {
    return registry.value[type]
  }

  return {
    registry,
    getDriveSchema,
    getDriveMeta
  }
}
