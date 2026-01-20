export const COPY_FORMATS = ['url', 'html', 'bbcode', 'markdown', 'MD with link'] as const

export const FORMAT_LABELS: Record<string, string> = {
    url: 'URL',
    html: 'HTML',
    bbcode: 'BBCode',
    markdown: 'Markdown',
    'MD with link': 'MD+Link',
    thumbUrl: 'Thumb'
}

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

export async function copyToClipboard(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text)
    } catch (err) {
        console.error('Failed to copy: ', err)
        throw err
    }
}

export function getValueByPath(obj: any, path: string): any {
    if (!path) return undefined
    // Support array syntax like data[0].url -> data.0.url
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1')
    return normalizedPath.split('.').reduce((acc, part) => acc && acc[part], obj)
}

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
