/**
 * @file icon.ts
 * @description 图标处理工具函数
 * 
 * 职责：
 * 1. 根据存储类型获取对应的图标类名
 * 2. 映射驱动类型到 UnoCSS 图标类
 * 
 * 依赖：
 * - @/constants/driveSchemas: 驱动注册表常量
 */

import { DRIVE_REGISTRY } from '@/constants/driveSchemas'

/**
 * 获取存储类型对应的图标类名
 * 如果类型未定义或未注册，返回默认硬盘图标
 * 
 * @param type - 存储类型字符串 (如 'github', 's3')
 * @returns UnoCSS 图标类名字符串
 */
export function getStorageIcon(type: string | undefined): string {
    if (!type) {
        return 'i-ph-hard-drive-duotone'
    }

    const registryItem = DRIVE_REGISTRY[type.toLowerCase()]
    return registryItem ? registryItem.icon : 'i-ph-hard-drive-duotone'
}
