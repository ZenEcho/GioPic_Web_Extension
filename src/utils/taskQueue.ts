/**
 * @file taskQueue.ts
 * @description 通用异步任务队列管理工具
 * 
 * 职责：
 * 1. 管理异步任务的执行顺序和并发度
 * 2. 支持任务添加、删除、暂停、恢复、重试
 * 3. 维护任务状态（pending, processing, success, error）
 * 
 * 依赖：
 * - vue: 使用 reactive 响应式数据
 */

import { reactive, watch } from 'vue'

export type TaskStatus = 'pending' | 'processing' | 'success' | 'error' | 'paused'

/**
 * 任务接口定义
 */
export interface ITask {
    id: string
    status: TaskStatus
    [key: string]: any
}

/**
 * 任务处理器函数类型
 */
export type TaskProcessor<T> = (task: T) => Promise<void>

/**
 * 任务队列类
 * @template T - 具体的任务类型，必须继承自 ITask
 */
export class TaskQueue<T extends ITask> {
    // 响应式任务列表
    public items = reactive<T[]>([])
    // 并发限制数
    private concurrency: number
    // 任务处理函数
    private processor: TaskProcessor<T>
    // 当前活跃（正在处理）的任务数
    private activeCount = 0
    // 是否暂停
    private isPaused = false
    // 是否自动开始
    private autoStart = true

    /**
     * 构造函数
     * @param processor - 任务处理逻辑函数
     * @param concurrency - 最大并发数，默认为 3
     * @param autoStart - 添加任务后是否自动开始执行，默认为 true
     */
    constructor(processor: TaskProcessor<T>, concurrency = 3, autoStart = true) {
        this.processor = processor
        this.concurrency = concurrency
        this.autoStart = autoStart
        this.isPaused = !autoStart
    }

    /**
     * 添加任务到队列
     * @param task - 任务对象
     */
    add(task: T) {
        if (!task.status) {
            task.status = 'pending'
        }
        // 使用 markRaw 避免 Vue 将传入的 task 转为 Ref，确保 push 的是原始对象
        // 注意：这里代码实际上没用 markRaw，可能是注释遗留或逻辑简化。
        // Vue reactive 数组会自动 wrap 对象。
        (this.items as any).push(task)
        if (this.autoStart) {
            this.processNext()
        }
    }

    /**
     * 从队列中移除任务
     * @param id - 任务 ID
     */
    remove(id: string) {
        const index = this.items.findIndex(i => i.id === id)
        if (index > -1) {
            this.items.splice(index, 1)
        }
    }

    /**
     * 清空队列
     * 注意：这不会停止正在运行的任务，但会清除所有未完成和已完成的任务记录
     */
    clear() {
        // Only clear non-processing items or force clear?
        // Usually clear completed or all. 
        // Let's clear all except processing for safety, or just all.
        // If we remove processing items, we can't stop the promise but we can remove reference.
        this.items.splice(0, this.items.length)
        this.activeCount = 0
    }

    /**
     * 启动/恢复队列执行
     */
    async start() {
        this.isPaused = false
        this.processNext()
    }

    /**
     * 暂停队列执行
     * 正在执行的任务会继续直到完成，但不会启动新任务
     */
    pause() {
        this.isPaused = true
    }

    /**
     * 重试指定任务
     * 将任务状态重置为 pending 并尝试调度
     * @param id - 任务 ID
     */
    retry(id: string) {
        const task = this.items.find(i => i.id === id)
        if (task) {
            // 如果是自动模式，设为 pending 并尝试 processNext
            // 如果是手动模式（autoStart=false），通常 retry 意味着我们想重试这一个
            // 但 retry 方法语义通常是“重置状态”。
            // 如果要立即重试，应该调 trigger。
            // 这里我们只重置状态。
            task.status = 'pending'
            if (!this.isPaused) {
                this.processNext()
            }
        }
    }

    /**
     * 重试所有失败的任务
     */
    retryAllFailed() {
        this.items.forEach(task => {
            if (task.status === 'error') {
                task.status = 'pending'
            }
        })
        this.start()
    }

    /**
     * 内部方法：执行单个任务
     * @param task - 任务对象
     */
    private async runTask(task: T) {
        this.activeCount++
        task.status = 'processing'

        try {
            await this.processor(task)
            task.status = 'success'
        } catch (error) {
            console.error('Task failed:', error)
            task.status = 'error'
        } finally {
            this.activeCount--
            this.processNext()
        }
    }

    /**
     * 内部方法：调度下一个任务
     * 检查并发限制和暂停状态
     */
    private async processNext() {
        if (this.isPaused) return
        if (this.activeCount >= this.concurrency) return

        const nextTask = this.items.find(t => t.status === 'pending')
        if (!nextTask) return

        // Use runTask but without re-checking conditions (already checked)
        // But runTask is async and we don't await it here to allow concurrency loop
        this.runTask(nextTask as T)
        
        // Try to schedule more if concurrency allows
        if (this.activeCount < this.concurrency) {
            this.processNext() 
        }
    }
    
    /**
     * 手动触发指定任务执行
     * 允许绕过暂停状态和并发限制（适度）
     * @param id - 任务 ID
     */
    trigger(id: string) {
        const task = this.items.find(t => t.id === id)
        if (task && task.status !== 'processing') {
             // 强制运行，绕过 isPaused 检查
             // 允许稍微突破并发限制以响应用户操作
             this.runTask(task as T)
        }
    }
}
