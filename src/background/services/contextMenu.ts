/**
 * @file contextMenu.ts
 * @description 右键菜单服务
 * 
 * 职责：
 * 1. 创建和管理“上传图片”右键菜单
 * 2. 处理右键菜单点击事件，执行图片下载和上传流程
 * 3. 广播上传进度和结果给 Content Script
 * 4. 管理后台上传队列状态
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 * - @/utils/storage: IndexedDB 工具
 * - @/services/uploader: 上传核心服务
 * - ./imageService: 图片下载服务
 * - ./notificationService: 通知服务
 */

import browser from 'webextension-polyfill'
import { db } from '@/utils/storage'
import { uploadImage } from '@/services/uploader'
import type { DriveConfig, UploadRecord } from '@/types'
import { downloadImage } from './imageService'
import { notify } from './notificationService'
import i18n from '@/i18n'

const MENU_ID = 'upload-image'

/**
 * 创建菜单
 */
function createMenu() {
    // 先移除以防重复，虽然 removeAll 会清除所有
    browser.contextMenus.removeAll().then(() => {
        browser.contextMenus.create({
            id: MENU_ID,
            title: i18n.global.t('background.contextMenuTitle'),
            contexts: ['image']
        }, () => {
            if (browser.runtime.lastError) {
                console.log('Context menu creation check:', browser.runtime.lastError.message)
            }
        })
    }).catch(err => {
         console.warn('Failed to remove context menus:', err)
    })
}

/**
 * 移除菜单
 */
function removeMenu() {
    browser.contextMenus.removeAll()
}

/**
 * 初始化右键菜单
 * 仅当菜单不存在时创建，避免重复创建错误
 */
export async function setupContextMenus() {
    // 检查设置
    const res = await browser.storage.local.get('giopic-context-menu')
    const enabled = res['giopic-context-menu'] !== false // Default true

    if (enabled) {
        createMenu()
    }

    // 监听设置变化
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes['giopic-context-menu']) {
            const newVal = changes['giopic-context-menu'].newValue !== false
            if (newVal) {
                createMenu()
            } else {
                removeMenu()
            }
        }
    })

    if (!browser.contextMenus.onClicked.hasListener(handleContextMenuClick)) {
        browser.contextMenus.onClicked.addListener(handleContextMenuClick)
    }
}

/**
 * 更新右键菜单的语言
 * 当用户切换语言设置时调用
 */
export function updateContextMenuLocale() {
    browser.contextMenus.update(MENU_ID, {
        title: i18n.global.t('background.contextMenuTitle')
    }).catch(() => {
        // Ignore error if menu doesn't exist (e.g. disabled)
    })
}

/**
 * 发送上传事件广播
 * 
 * @param originTabId - 触发上传的原始标签页 ID
 * @param event - 事件类型 ('start' | 'progress' | 'success' | 'fail')
 * @param id - 上传任务 ID
 * @param payload - 事件负载数据
 */
async function sendUploadEvent(
    originTabId: number | undefined,
    event: 'start' | 'progress' | 'success' | 'fail',
    id: string,
    payload: any
) {
    try {
        // Broadcast to all tabs
        const tabs = await browser.tabs.query({})
        for (const tab of tabs) {
            if (tab.id) {
                // Determine if this tab is the origin tab
                const isOrigin = originTabId !== undefined && tab.id === originTabId

                browser.tabs.sendMessage(tab.id, {
                    type: 'UPLOAD_EVENT',
                    data: { event, id, payload, isOrigin }
                }).catch(() => {
                    // Ignore errors (e.g. content script not loaded in this tab)
                })
            }
        }
    } catch (e) {
        console.warn('Failed to send upload event', e)
    }
}

/**
 * 更新后台上传队列状态
 * 同步到 browser.storage.local 以便 popup/content 监听变化
 * 
 * @param action - 操作类型 ('add' | 'update')
 * @param item - 队列项数据
 */
async function updateUploadQueue(action: 'add' | 'update', item: any) {
    try {
        const key = 'giopic-upload-queue'
        // Use browser.storage.local for sync capabilities (onChanged event)
        const res = await browser.storage.local.get(key)
        const data = res[key] as any[] || []
        const newQueue = [...data]

        if (action === 'add') {
            newQueue.unshift(item)
        } else if (action === 'update') {
            const index = newQueue.findIndex(i => i.id === item.id)
            if (index !== -1) {
                newQueue[index] = { ...newQueue[index], ...item }
            }
        }
        
        // Limit queue size to 50
        if (newQueue.length > 50) newQueue.length = 50
        
        await browser.storage.local.set({ [key]: newQueue })
    } catch (e) {
        console.error('Failed to update upload queue', e)
    }
}

/**
 * 处理右键菜单点击事件
 * 执行完整的下载 -> 上传 -> 通知流程
 * 
 * @param info - 点击信息
 * @param tab - 当前标签页信息
 */
async function handleContextMenuClick(info: any, tab: any) {
    if (info.menuItemId === MENU_ID && info.srcUrl) {
        // await notify('GioPic', i18n.global.t('background.downloading'), 'info')

        try {
            // 1. Get Configs
            const configs = await db.get<DriveConfig[]>('giopic-configs')
            const selectedIds = await db.get<string[]>('giopic-selected-ids')
            
            if (!configs || !selectedIds || selectedIds.length === 0) {
                throw new Error(i18n.global.t('background.noConfigOrSelection'))
            }

            const activeConfigs = configs.filter(c => selectedIds.includes(c.id) && c.enabled)

            if (activeConfigs.length === 0) {
                throw new Error(i18n.global.t('background.noEnabledConfig'))
            }

            // 2. Download Image
            const file = await downloadImage(info.srcUrl)
            
            // 3. Upload to all selected nodes
            const results = await Promise.allSettled(activeConfigs.map(async (config) => {
                const uploadId = crypto.randomUUID()
                const queueItem = {
                    id: uploadId,
                    filename: file.name,
                    configName: config.name,
                    progress: 0,
                    status: 'uploading',
                    thumbUrl: info.srcUrl, // Use original URL as thumbnail initially
                    timestamp: Date.now()
                }

                // Add to storage queue
                await updateUploadQueue('add', queueItem)
                
                // Send start event
                await sendUploadEvent(tab?.id, 'start', uploadId, queueItem)

                return uploadImage(file, config, (progress) => {
                    // Send progress event
                    sendUploadEvent(tab?.id, 'progress', uploadId, { progress })
                }).then(async res => {
                    // Update storage
                    await updateUploadQueue('update', {
                        id: uploadId,
                        status: 'success',
                        progress: 100,
                        url: res.url,
                        thumbUrl: res.thumbUrl || info.srcUrl
                    })

                    // Send success event
                    sendUploadEvent(tab?.id, 'success', uploadId, { 
                        url: res.url,
                        thumbUrl: res.thumbUrl || info.srcUrl
                    })
                    return { config, res }
                }).catch(async err => {
                    // Update storage
                    await updateUploadQueue('update', {
                        id: uploadId,
                        status: 'error',
                        error: err.message || 'Upload failed'
                    })

                    // Send fail event
                    sendUploadEvent(tab?.id, 'fail', uploadId, { 
                        error: err.message || 'Upload failed'
                    })
                    throw err
                })
            }))

            // 4. Process results
            const successCount = results.filter(r => r.status === 'fulfilled').length
            const failCount = results.filter(r => r.status === 'rejected').length

            // Save history
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    // @ts-ignore
                    const { config, res } = result.value
                    const record: UploadRecord = {
                        id: crypto.randomUUID(),
                        url: res.url,
                        filename: file.name,
                        configId: config.id,
                        configName: config.name,
                        createdAt: Date.now(),
                        status: 'success',
                        thumbUrl: res.thumbUrl,
                    }
                    await saveToHistory(record)
                }
            }
            
            // 5. Final Notification
            if (failCount === 0) {
                await notify(i18n.global.t('background.uploadComplete'), i18n.global.t('background.uploadSuccess', { count: successCount }), 'success')
            } else {
                await notify(i18n.global.t('background.uploadFinished'), i18n.global.t('background.uploadResult', { success: successCount, fail: failCount }), 'warning')
            }

        } catch (error: any) {
            console.error('Upload failed', error)
            await notify(i18n.global.t('background.uploadFailed'), error.message || i18n.global.t('background.unknownError'), 'error')
        }
    }
}

/**
 * 保存上传记录到历史记录数据库
 * 
 * @param record - 上传记录
 */
async function saveToHistory(record: UploadRecord) {
    const history = (await db.get<UploadRecord[]>('giopic-history')) || []
    history.unshift(record)
    await db.set('giopic-history', history)
}
