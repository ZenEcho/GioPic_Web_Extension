import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { TaskQueue } from '@/utils/taskQueue'
import { uploadImage } from '@/services/uploader'
import type { QueueItem, UploadTask } from '@/types'

export function useUploadQueue() {
    const { t } = useI18n()
    const message = useMessage()
    const configStore = useConfigStore()
    const historyStore = useHistoryStore()

    async function processTask(item: QueueItem, task: UploadTask) {
        const config = configStore.configs.find(c => c.id === task.configId)
        if (!config) {
            task.status = 'error'
            task.error = t('home.upload.configNotFound')
            return
        }

        task.status = 'uploading'
        task.progress = 0

        try {
            const result = await uploadImage(item.file, config, (progress) => {
                task.progress = progress
            })

            task.status = 'success'
            task.result = result.url

            // 触发自动注入
            try {
                await browser.runtime.sendMessage({
                    type: 'RELAY_UPLOAD_SUCCESS',
                    id: task.id,
                    payload: {
                        url: result.url,
                        thumbUrl: result.thumbUrl || result.url
                    }
                })
            } catch (e) {
                console.warn('Failed to notify background', e)
            }

            // 添加到历史记录
            historyStore.addRecord({
                id: task.id,
                url: result.url,
                filename: item.file.name,
                configId: config.id,
                configName: config.name,
                createdAt: Date.now(),
                status: 'success',
                thumbUrl: result.thumbUrl || result.url
            })

        } catch (e: any) {
            task.status = 'error'
            task.error = e.message || t('home.upload.uploadFailed')
        }
    }

    async function processQueueItem(item: QueueItem) {
        const promises = item.tasks
            .filter(t => t.status === 'pending' || t.status === 'error')
            .map(t => processTask(item, t))

        await Promise.all(promises)

        if (item.tasks.some(t => t.status === 'error')) {
            throw new Error('Some tasks failed')
        }
    }

    const fileQueue = new TaskQueue<QueueItem>(processQueueItem, 2, false)

    function addFileToQueue(file: File) {
        if (configStore.selectedIds.length === 0) {
            message.warning(t('home.upload.selectNodeWarning'))
            return
        }

        const id = Date.now().toString() + Math.random().toString(36).substring(2)
        const preview = URL.createObjectURL(file)

        const tasks: UploadTask[] = configStore.selectedIds.map(configId => ({
            id: id + '-' + configId,
            configId,
            status: 'pending',
            progress: 0
        }))

        const newItem: QueueItem = {
            id,
            file,
            preview,
            tasks,
            status: 'pending'
        }

        fileQueue.add(newItem)
    }

    return {
        fileQueue,
        addFileToQueue
    }
}
