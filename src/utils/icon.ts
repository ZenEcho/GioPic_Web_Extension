
/**
 * 获取存储类型对应的图标类名
 * @param type 存储类型字符串
 * @returns 图标类名
 */
export function getStorageIcon(type: string | undefined): string {
    if (!type) {
        return 'i-ph-hard-drive-duotone'
    }

    const icons: Record<string, string> = {
        'lsky': 'i-ph-cloud-arrow-up-duotone',
        'easyimages': 'i-ph-image-duotone',
        'chevereto': 'i-ph-images-square-duotone',
        'imgurl': 'i-ph-link-duotone',
        'zpic': 'i-ph-lightning-duotone',
        'hellohao': 'i-ph-chat-circle-dots-duotone',
        'aliyun': 'i-ph-cube-duotone',
        'tencent': 'i-ph-cloud-duotone',
        'aws': 'i-ph-database-duotone',
        'smms': 'i-ph-image-duotone',
        'imgur': 'i-ph-arrow-fat-up-duotone',
        'github': 'i-ph-github-logo-duotone',
        'custom': 'i-ph-code-duotone'
    }

    return icons[type.toLowerCase()] || 'i-ph-hard-drive-duotone'
}
