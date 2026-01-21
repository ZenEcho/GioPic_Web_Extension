import browser from 'webextension-polyfill'
import { db } from '@/utils/storage'
import { uploadImage } from '@/services/uploader'
import type { DriveConfig, UploadRecord } from '@/types'
import { downloadImage } from './imageService'
import { notify } from './notificationService'
import i18n from '@/i18n'

export function setupContextMenus() {
    browser.contextMenus.removeAll().then(() => {
        browser.contextMenus.create({
            id: 'upload-image',
            title: i18n.global.t('background.contextMenuTitle'),
            contexts: ['image']
        })
    })

    if (!browser.contextMenus.onClicked.hasListener(handleContextMenuClick)) {
        browser.contextMenus.onClicked.addListener(handleContextMenuClick)
    }
}

export function updateContextMenuLocale() {
    browser.contextMenus.update('upload-image', {
        title: i18n.global.t('background.contextMenuTitle')
    })
}

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

async function handleContextMenuClick(info: any, tab: any) {
    if (info.menuItemId === 'upload-image' && info.srcUrl) {
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
                        deleteUrl: res.deleteUrl
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

async function saveToHistory(record: UploadRecord) {
    const history = (await db.get<UploadRecord[]>('giopic-history')) || []
    history.unshift(record)
    // Limit to 1000
    if (history.length > 1000) {
        history.length = 1000
    }
    await db.set('giopic-history', history)
}
