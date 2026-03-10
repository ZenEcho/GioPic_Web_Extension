/**
 * Plugin Runner (插件调度器)
 * 
 * 角色: Scheduler (调度器)
 * 职责:
 * 1. 生命周期管理: 负责创建和销毁 Offscreen Document。
 * 2. 健康检查: 通过 PING/PONG 机制检测 Offscreen 环境是否就绪。
 * 3. 任务分发: 将用户上传操作或配置脚本封装为 EXECUTE_PLUGIN 消息，发送给 Offscreen。
 * 4. 事件驱动: 使用 taskId 跟踪异步任务，监听执行结果和进度事件。
 * 
 * 对应架构文档: plugins/plugin_architecture.md # Plugin Runner
 */

import { db } from '@/utils/storage'
import type { PluginDriveConfig, PluginMeta } from '@/types'
import browser from 'webextension-polyfill'

const PLUGIN_TASK_TIMEOUT_MS = 30000

interface SerializedPluginFile {
  name: string
  type: string
  size: number
  data: string
}

interface PendingTask {
  resolve: (value: any) => void
  reject: (error: Error) => void
  onProgress?: (progress: number) => void
  timeoutId: ReturnType<typeof setTimeout>
}

interface PluginTaskPayload {
  mode: 'upload' | 'config'
  script: string
  inputs: Record<string, any>
  file?: SerializedPluginFile
}

/**
 * 辅助函数：将 File 对象转换为 Base64 字符串
 * 用于跨进程传递文件数据（Chrome 消息传递不支持直接传输 File 对象）
 * 
 * @param file - 待转换的文件对象
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 全局任务映射表
// Key: TaskID
// Value: Promise 的 resolve/reject 函数以及进度回调
const pendingTasks = new Map<string, PendingTask>()

function clearPendingTask(taskId: string) {
  const task = pendingTasks.get(taskId)
  if (!task) {
    return
  }

  clearTimeout(task.timeoutId)
  pendingTasks.delete(taskId)
}

/**
 * 监听来自 Offscreen 的消息结果
 * Offscreen 完成任务后会通过 runtime.sendMessage 发回结果
 */
// @ts-ignore
if (typeof chrome !== 'undefined' && chrome.runtime) {
    // @ts-ignore
    chrome.runtime.onMessage.addListener((msg: any) => {
        if (!msg.taskId) {
            return
        }

        const task = pendingTasks.get(msg.taskId)
        if (!task) {
            return
        }

        if (msg.type === 'PLUGIN_EXECUTION_RESULT') {
            clearPendingTask(msg.taskId)
            if (msg.success) {
                task.resolve(msg.result)
            } else {
                task.reject(new Error(msg.error || 'Plugin execution failed'))
            }
            return
        }

        if (msg.type === 'PLUGIN_PROGRESS' && task.onProgress) {
            task.onProgress(msg.percent)
        }
    })
}

async function ensureOffscreenReady() {
  // @ts-ignore
  if (typeof browser === 'undefined' || !browser.offscreen) {
    return
  }

  try {
    // @ts-ignore
    const hasDoc = await browser.offscreen.hasDocument()
    if (!hasDoc) {
      // @ts-ignore
      await browser.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER' as any],
        justification: 'Execute Plugin Sandbox'
      })
    }

    let ready = false
    let lastError = ''
    for (let i = 0; i < 50; i += 1) {
      try {
        const pong = await browser.runtime.sendMessage({ type: 'PING' }).catch((err: any) => {
          lastError = err.message
          return null
        })

        if (pong === 'PONG') {
          ready = true
          break
        }
      } catch (error: any) {
        lastError = error.message
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (!ready) {
      console.warn('Offscreen did not respond to PING, closing and recreating...', lastError)
      try {
        // @ts-ignore
        await browser.offscreen.closeDocument()
      } catch {
        // noop
      }

      // @ts-ignore
      await browser.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER' as any],
        justification: 'Execute Plugin Sandbox'
      })

      await new Promise(resolve => setTimeout(resolve, 500))
    }
  } catch (error: any) {
    if (!error.message?.includes('Only a single offscreen document')) {
      console.warn('Offscreen creation warning:', error)
    }
  }
}

async function dispatchPluginTask(payload: PluginTaskPayload, onProgress?: (progress: number) => void): Promise<any> {
  await ensureOffscreenReady()
  const taskId = Math.random().toString(36).slice(2)

  return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
          if (pendingTasks.has(taskId)) {
              clearPendingTask(taskId)
              reject(new Error(`Plugin execution timed out (${PLUGIN_TASK_TIMEOUT_MS / 1000}s)`))
          }
      }, PLUGIN_TASK_TIMEOUT_MS)

      pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress,
        timeoutId,
      })
      
      // @ts-ignore
      chrome.runtime.sendMessage({
          type: 'EXECUTE_PLUGIN',
          id: taskId,
          mode: payload.mode,
          script: payload.script,
          inputs: payload.inputs,
          file: payload.file,
      }, () => {
           // @ts-ignore
           if (chrome.runtime.lastError) {
               // @ts-ignore
               console.error('[PluginRunner] Send message error:', chrome.runtime.lastError)
               clearPendingTask(taskId)
               // @ts-ignore
               reject(new Error(chrome.runtime.lastError.message))
           }
      })
  })
}

/**
 * 执行插件上传逻辑
 * 
 * @param config - 插件图床配置
 * @param file - 要上传的文件
 * @param onProgress - 上传进度回调
 * @returns Promise<string> - 上传成功后的图片 URL
 */
export async function runPlugin(config: PluginDriveConfig, file: File, onProgress?: (progress: number) => void): Promise<string> {
  // 直接从 Storage 读取插件列表，以支持 Background Service Worker 环境 (无 Pinia 实例)
  const plugins = await db.get<PluginMeta[]>('plugins') || []
  const plugin = plugins.find(p => p.id === config.type && p.enabled !== false)
  
  if (!plugin) {
    throw new Error(`Plugin ${config.type} not found`)
  }

  const base64 = await fileToBase64(file)
  return dispatchPluginTask({
    mode: 'upload',
    script: plugin.script,
    inputs: config,
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
      data: base64,
    },
  }, onProgress)
}

export async function runPluginConfigScript(script: string, config: Record<string, any>): Promise<any> {
  return dispatchPluginTask({
    mode: 'config',
    script,
    inputs: config,
  })
}
