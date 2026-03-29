import browser from 'webextension-polyfill'
import type { DetectorPageInfo } from '@/types'

interface DetectorSandboxTaskPayload {
  page: DetectorPageInfo
  script: string
  input?: Record<string, any>
  state?: Record<string, any>
}

interface DetectorSandboxHandler {
  handleRpc(method: string, params: Record<string, any>, page: DetectorPageInfo): Promise<any>
  handleLog?(level: 'log' | 'warn' | 'error', args: unknown[], page: DetectorPageInfo): void
}

interface PendingTask {
  resolve: (value: any) => void
  reject: (error: Error) => void
  handler: DetectorSandboxHandler
  page: DetectorPageInfo
}

const SANDBOX_ID = 'giopic-site-detector-sandbox'
const SANDBOX_READY_TIMEOUT = 5000
const SANDBOX_URL = browser.runtime.getURL('src/sandbox/site-detector.html')

class SiteDetectorSandbox {
  private frame: HTMLIFrameElement | null = null

  private readyPromise: Promise<void> | null = null

  private readyResolve: (() => void) | null = null

  private readyReject: ((error: Error) => void) | null = null

  private readyTimer: ReturnType<typeof setTimeout> | null = null

  private pendingTasks = new Map<string, PendingTask>()

  private boundMessageHandler = this.handleMessage.bind(this)

  async execute(payload: DetectorSandboxTaskPayload, handler: DetectorSandboxHandler): Promise<any> {
    await this.ensureReady()

    if (!this.frame?.contentWindow) {
      throw new Error('Site detector sandbox is not ready')
    }

    const taskId = Math.random().toString(36).slice(2)
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        handler,
        page: payload.page,
      })

      this.frame!.contentWindow!.postMessage({
        __giopicDetector: true,
        type: 'EXECUTE',
        taskId,
        payload,
      }, '*')
    })
  }

  private async ensureReady(): Promise<void> {
    if (!this.frame) {
      this.frame = document.getElementById(SANDBOX_ID) as HTMLIFrameElement | null
    }

    if (!this.frame) {
      this.frame = document.createElement('iframe')
      this.frame.id = SANDBOX_ID
      this.frame.style.display = 'none'
      this.frame.src = SANDBOX_URL
      document.documentElement.appendChild(this.frame)
    } else if (this.frame.src !== SANDBOX_URL) {
      this.frame.src = SANDBOX_URL
    }

    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>((resolve, reject) => {
        this.readyResolve = resolve
        this.readyReject = reject
        this.readyTimer = setTimeout(() => {
          this.rejectReady(new Error('Site detector sandbox ready timeout'))
        }, SANDBOX_READY_TIMEOUT)
      })
      window.addEventListener('message', this.boundMessageHandler)
    }

    return this.readyPromise
  }

  private resolveReady() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer)
      this.readyTimer = null
    }

    this.readyResolve?.()
    this.readyResolve = null
    this.readyReject = null
  }

  private rejectReady(error: Error) {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer)
      this.readyTimer = null
    }

    this.readyReject?.(error)
    this.readyPromise = null
    this.readyResolve = null
    this.readyReject = null
  }

  private async handleMessage(event: MessageEvent) {
    if (event.source !== this.frame?.contentWindow) {
      return
    }

    const data = event.data
    if (!data || !data.__giopicDetector) {
      return
    }

    if (data.type === 'SANDBOX_READY') {
      this.resolveReady()
      return
    }

    if (data.type === 'SANDBOX_LOG') {
      const task = this.pendingTasks.get(data.taskId)
      task?.handler.handleLog?.(data.level, Array.isArray(data.args) ? data.args : [], task.page)
      return
    }

    if (data.type === 'RPC_REQUEST') {
      const task = this.pendingTasks.get(data.taskId)
      if (!task || !this.frame?.contentWindow) {
        return
      }

      try {
        const result = await task.handler.handleRpc(data.method, data.params || {}, task.page)
        this.frame.contentWindow.postMessage({
          __giopicDetector: true,
          type: 'RPC_RESPONSE',
          rpcId: data.rpcId,
          result,
        }, '*')
      } catch (error: any) {
        this.frame.contentWindow.postMessage({
          __giopicDetector: true,
          type: 'RPC_RESPONSE',
          rpcId: data.rpcId,
          error: error?.message || String(error),
        }, '*')
      }
      return
    }

    if (data.type === 'EXECUTE_RESULT') {
      const task = this.pendingTasks.get(data.taskId)
      if (!task) {
        return
      }

      this.pendingTasks.delete(data.taskId)
      if (data.error) {
        task.reject(new Error(data.error))
      } else {
        task.resolve(data.result)
      }
    }
  }
}

export const siteDetectorSandbox = new SiteDetectorSandbox()
