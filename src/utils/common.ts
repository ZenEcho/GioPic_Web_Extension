/**
 * @file common.ts
 * @description 通用工具函数库
 * 
 * 职责：
 * 1. 提供链接格式化（URL, Markdown, HTML 等）功能
 * 2. 提供剪贴板复制功能
 * 3. 提供对象路径访问（getValueByPath）和 JSON 解析工具
 */

/**
 * 支持的复制格式列表
 */
export const COPY_FORMATS = ['url', 'html', 'bbcode', 'markdown', 'MD with link'] as const

/**
 * 格式显示标签映射
 */
export const FORMAT_LABELS: Record<string, string> = {
    url: 'URL',
    html: 'HTML',
    bbcode: 'BBCode',
    markdown: 'Markdown',
    'MD with link': 'MD+Link',
    thumbUrl: 'Thumb'
}

/**
 * 格式化图片链接
 * 根据指定的格式模板生成对应的字符串
 * 
 * @param url - 图片原始 URL
 * @param format - 目标格式 (url, html, bbcode, markdown, etc.)
 * @param thumbUrl - 缩略图 URL (可选，仅当 format 为 'thumbUrl' 时使用)
 * @returns 格式化后的字符串
 */
export function formatLink(url: string, format: string, thumbUrl?: string): string {
    switch (format) {
        case 'html': return `<img src="${url}" alt="image" />`
        case 'bbcode': return `[img]${url}[/img]`
        case 'markdown': return `![](${url})`
        case 'MD with link': return `[![](${url})](${url})`
        case 'thumbUrl': return thumbUrl || url
        default: return url
    }
}

/**
 * 复制文本到剪贴板
 * 使用 navigator.clipboard API
 * 
 * @param text - 待复制的文本内容
 * @throws 当复制失败时抛出错误
 */
export async function copyToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text)
    } catch (err) {
        console.error('Failed to copy: ', err)
        throw err
    }
}

/**
 * 通过字符串路径获取对象属性值
 * 支持点号和数组下标语法，例如: "data[0].url" 或 ".data.url"
 * 
 * @param obj - 目标对象
 * @param path - 属性路径字符串
 * @returns 属性值，如果路径不存在则返回 undefined
 */
export function getValueByPath(obj: any, path: string): any {
    if (!path) return undefined
    // Support array syntax like data[0].url -> data.0.url
    // Also remove leading dot if path starts with array index like [0].src -> .0.src -> 0.src
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '')
    return normalizedPath.split('.').reduce((acc, part) => acc && acc[part], obj)
}

/**
 * 解析 JSON 配置字符串
 * 支持对象和数组格式，如果解析失败返回空对象
 * 
 * @param jsonStr - JSON 字符串
 * @returns 解析后的对象，如果输入为空或解析失败则返回空对象
 */
export function parseJsonConfig(jsonStr: string | undefined): Record<string, any> {
    if (!jsonStr) return {}
    try {
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed)) {
            return parsed.reduce((acc, curr) => {
                if (curr.key) acc[curr.key] = curr.value
                return acc
            }, {})
        }
        return parsed
    } catch (e) {
        console.warn('Failed to parse JSON config', e)
        return {}
    }
}
