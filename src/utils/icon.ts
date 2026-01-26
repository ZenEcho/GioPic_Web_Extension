import { DRIVE_REGISTRY } from '@/constants/driveSchemas'

/**
 * 获取存储类型对应的图标类名
 * @param type 存储类型字符串
 * @returns 图标类名
 */
export function getStorageIcon(type: string | undefined): string {
    if (!type) {
        return 'i-ph-hard-drive-duotone'
    }

    const registryItem = DRIVE_REGISTRY[type.toLowerCase()]
    return registryItem ? registryItem.icon : 'i-ph-hard-drive-duotone'
}
