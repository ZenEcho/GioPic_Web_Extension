import { type UploadRecord, type TestConfig } from '@/types'
import { useHistoryStore } from '@/stores/history'
import { useConfigStore } from '@/stores/config'

/**
 * 模拟上传配置 (Dev Only)
 */
export const mockConfig: TestConfig = {
    id: 'mock-drive-test-001',
    name: '模拟上传驱动 (Dev)',
    type: 'test',
    enabled: true,
    apiUrl: 'https://fileup.dev/',
    token: 'mock-token'
}

/**
 * 创建模拟图片文件
 * @param index - 序号
 * @returns Promise<File>
 */
export function createMockFile(index: number): Promise<File> {
    return new Promise((resolve) => {
        const seed = Math.random().toString(36).substring(7)
        const url = `https://picsum.photos/seed/${seed}/800/600`
        
        fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], `mock_img_seed_${seed}.jpg`, { type: 'image/jpeg' })
                resolve(file)
            })
            .catch(() => {
                // Fallback if network fails
                const canvas = document.createElement('canvas')
                canvas.width = 800
                canvas.height = 600
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.fillStyle = '#eee'
                    ctx.fillRect(0, 0, 800, 600)
                    ctx.fillStyle = '#333'
                    ctx.fillText('Mock Image (Offline)', 300, 300)
                }
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(new File([blob], `mock_offline_${Date.now()}.png`, { type: 'image/png' }))
                    }
                })
            })
    })
}

/**
 * 获取模拟 ID
 */
function getMockId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 随机选择一个配置，如果没有则返回默认模拟配置
 */
function pickConfig() {
    const configStore = useConfigStore()
    const configs = configStore.configs
    if (configs.length === 0) {
        return { id: 'mock-drive-test-001', name: '模拟上传驱动 (Dev)' }
    }
    const index = Math.floor(Math.random() * configs.length)
    const chosen = configs[index]
    if (!chosen) return { id: 'mock-drive-test-001', name: '模拟上传驱动 (Dev)' }
    return { id: chosen.id, name: chosen.name }
}

/**
 * 创建模拟历史记录
 */
export function createMockRecord(i: number, createdAt: number): UploadRecord {
    const id = getMockId()
    const seed = `${createdAt}-${i}-${id}`
    const config = pickConfig()

    return {
        id,
        url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/900.webp`,
        thumbUrl: `https://picsum.photos/seed/${encodeURIComponent(seed)}/480/360.webp`,
        filename: `mock-${createdAt}-${String(i + 1).padStart(4, '0')}.webp`,
        configId: config.id,
        configName: config.name,
        createdAt,
        status: 'success'
    }
}

/**
 * 批量插入模拟记录到历史记录 Store
 * @param count - 插入数量
 * @returns 实际插入的数量
 */
export function insertMockRecordsToStore(count: number): number {
    const historyStore = useHistoryStore()
    // 提升上限到 200 万
    const safeCount = Math.max(1, Math.min(20000000, Math.floor(count)))  // 限制最大 200 万条
    const now = Date.now()
    
    // 生成所有记录
    const records: UploadRecord[] = []
    for (let i = safeCount - 1; i >= 0; i--) {
        records.push(createMockRecord(i, now - i * 10000)) 
    }
    
    // 一次性批量添加
    historyStore.batchAddRecords(records)
    
    return safeCount
}
