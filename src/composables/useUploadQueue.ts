/**
 * @file useUploadQueue.ts
 * @description 上传队列管理组合式函数
 * 
 * 职责：
 * 1. 管理多文件、多图床的并发上传任务
 * 2. 调度上传任务队列
 * 3. 处理上传成功/失败结果，更新历史记录
 * 4. 向 Background 发送上传成功消息
 * 
 * 依赖：
 * - @/utils/taskQueue: 通用任务队列
 * - @/stores/config: 配置 Store
 * - @/stores/history: 历史记录 Store
 * - @/services/uploader: 上传服务
 */

import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'
import { useConfigStore } from '@/stores/config'
import { useHistoryStore } from '@/stores/history'
import { TaskQueue } from '@/utils/taskQueue'
import { uploadImage } from '@/services/uploader'
import type { QueueItem, UploadTask } from '@/types'

/**
 * 上传队列管理的组合式函数
 * 负责管理上传任务队列、执行上传、处理结果和历史记录
 */
export function useUploadQueue() {
    const { t } = useI18n()
    const message = useMessage()
    const configStore = useConfigStore()
    const historyStore = useHistoryStore()

    /**
     * 处理单个上传任务（对应一个文件和一个图床配置）
     * 
     * @param item - 队列中的文件项
     * @param task - 具体的上传子任务
     */
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
            // 执行上传并更新进度
            const result = await uploadImage(item.file, config, (progress) => {
                task.progress = progress
            })

            task.status = 'success'
            task.result = result.url

            // 触发自动注入消息到 Background
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

    /**
     * 处理队列中的单个文件项
     * 一个文件可能需要上传到多个图床（多个子任务）
     * 
     * @param item - 队列文件项
     */
    async function processQueueItem(item: QueueItem) {
        const promises = item.tasks
            .filter(t => t.status === 'pending' || t.status === 'error')
            .map(t => processTask(item, t))

        await Promise.all(promises)

        // 检查是否有失败的任务
        const failedTasks = item.tasks.filter(t => t.status === 'error')
        if (failedTasks.length > 0) {
            const errorDetails = failedTasks.map(t => `${t.configId}: ${t.error}`).join('; ')
            throw new Error(`Tasks failed: ${errorDetails}`)
        }
    }

    // 初始化任务队列，并发数为 2
    const fileQueue = new TaskQueue<QueueItem>(processQueueItem, 2, false)

    /**
     * 添加文件到上传队列
     * 为每个选中的配置创建上传子任务
     * 
     * @param file - 待上传的文件
     */
    function addFileToQueue(file: File) {
        // 检查文件是否携带了模拟配置 (Dev Only)
        const mockConfig = (file as any)._mockConfig
        let targetConfigIds = configStore.selectedIds

        if (mockConfig) {
            // 如果是模拟上传，直接使用模拟配置 ID
            // 确保配置存在于 Store 中 (如果不存在则临时添加)
            if (!configStore.configs.find(c => c.id === mockConfig.id)) {
                configStore.addConfig(mockConfig)
            }
            targetConfigIds = [mockConfig.id]
        } else if (configStore.selectedIds.length === 0) {
            message.warning(t('home.upload.selectNodeWarning'))
            return
        }

        const id = Date.now().toString() + Math.random().toString(36).substring(2)
        const preview = URL.createObjectURL(file)

        // 为当前选中的每个图床配置创建一个子任务
        const tasks: UploadTask[] = targetConfigIds.map(configId => ({
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

    /**
     * 编辑队列中的文件（替换为编辑后的文件和预览）
     *
     * @param id - 队列项 ID
     * @param payload - 编辑后的文件和预览 URL
     */
    function editQueueItem(id: string, payload: { file: File; preview: string }) {
        const item = fileQueue.items.find((i: QueueItem) => i.id === id)
        if (item && (item.status === 'pending' || item.status === 'paused')) {
            // 释放旧的 preview URL
            if (item.preview) {
                URL.revokeObjectURL(item.preview)
            }
            // 替换文件和预览
            item.file = payload.file
            item.preview = payload.preview
        }
    }

    return {
        fileQueue,
        addFileToQueue,
        editQueueItem,
    }
}
