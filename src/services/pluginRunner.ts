/**
 * Plugin Runner (插件调度器)
 */

import { db } from '@/utils/storage'
import type { PluginDriveConfig, PluginMeta, UploaderPlugin } from '@/types'
import { isUploaderPlugin } from '@/types'
import { normalizeStoredPlugins } from '@/utils/pluginCore'
import browser from 'webextension-polyfill'

const PLUGIN_TASK_TIMEOUT_MS = 30000
const runtimeChrome = (globalThis as any).chrome

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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const pendingTasks = new Map<string, PendingTask>()

function clearPendingTask(taskId: string) {
  const task = pendingTasks.get(taskId)
  if (!task) {
    return
  }

  clearTimeout(task.timeoutId)
  pendingTasks.delete(taskId)
}

if (runtimeChrome?.runtime) {
  runtimeChrome.runtime.onMessage.addListener((msg: any) => {
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
  const offscreen = (browser as any).offscreen
  if (!offscreen) {
    return
  }

  try {
    const hasDoc = await offscreen.hasDocument()
    if (!hasDoc) {
      await offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Execute Plugin Sandbox',
      })
    }

    let ready = false
    let lastError = ''
    for (let i = 0; i < 50; i += 1) {
      try {
        const pong = await browser.runtime.sendMessage({ type: 'PING' }).catch((error: any) => {
          lastError = error.message
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
        await offscreen.closeDocument()
      } catch {}

      await offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Execute Plugin Sandbox',
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

    runtimeChrome.runtime.sendMessage({
      type: 'EXECUTE_PLUGIN',
      id: taskId,
      mode: payload.mode,
      script: payload.script,
      inputs: payload.inputs,
      file: payload.file,
    }, () => {
      if (runtimeChrome.runtime.lastError) {
        console.error('[PluginRunner] Send message error:', runtimeChrome.runtime.lastError)
        clearPendingTask(taskId)
        reject(new Error(runtimeChrome.runtime.lastError.message))
      }
    })
  })
}

export async function runPlugin(config: PluginDriveConfig, file: File, onProgress?: (progress: number) => void): Promise<string> {
  const plugins = normalizeStoredPlugins(await db.get<PluginMeta[]>('plugins'))
  const plugin = plugins.find((item): item is UploaderPlugin => item.id === config.type && item.enabled !== false && isUploaderPlugin(item))

  if (!plugin) {
    throw new Error(`Plugin ${config.type} not found`)
  }

  const base64 = await fileToBase64(file)
  return dispatchPluginTask({
    mode: 'upload',
    script: plugin.uploader.script,
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
