
import { computed } from 'vue'
import { DRIVE_REGISTRY, type DriveRegistryItem, type FieldSchema } from '@/constants/driveSchemas'
import { usePluginStore } from '@/stores/plugin'

export function useDriveRegistry() {
  const pluginStore = usePluginStore()
  
  const registry = computed(() => {
    const combined: Record<string, DriveRegistryItem> = { ...DRIVE_REGISTRY }
    
    // Merge plugins
    pluginStore.plugins.forEach(plugin => {
       if (plugin.enabled === false) return; // Skip disabled plugins

       const fields: FieldSchema[] = plugin.inputs.map(input => ({
           key: input.name,
           label: input.label, 
           type: input.type as any,
           required: input.required,
           defaultValue: input.default,
           options: input.options,
           placeholder: input.placeholder
       }));
       
       combined[plugin.id] = {
           key: plugin.id,
           label: plugin.name,
           icon: plugin.icon || 'i-ph-puzzle-piece',
           color: 'text-purple-600 bg-purple-100',
           darkColor: 'dark:text-purple-300 dark:bg-purple-900/30',
           category: 'plugin', 
           fields: fields
       };
    });
    
    return combined;
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
    getDriveMeta
  }
}
