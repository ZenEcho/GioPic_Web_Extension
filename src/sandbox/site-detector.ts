const pendingRpc = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>()
let sequence = 0
let currentTaskId = ''

function reply(payload: Record<string, any>) {
  window.parent.postMessage({
    __giopicDetector: true,
    ...payload,
  }, '*')
}

function serializeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function forwardConsole(level: 'log' | 'warn' | 'error', ...args: unknown[]) {
  try {
    reply({
      type: 'SANDBOX_LOG',
      taskId: currentTaskId,
      level,
      args: args.map(serializeLogValue),
    })
  } catch {}
}

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

console.log = (...args: unknown[]) => {
  originalConsole.log(...args)
  forwardConsole('log', ...args)
}

console.warn = (...args: unknown[]) => {
  originalConsole.warn(...args)
  forwardConsole('warn', ...args)
}

console.error = (...args: unknown[]) => {
  originalConsole.error(...args)
  forwardConsole('error', ...args)
}

function normalizeInput(input: unknown): string {
  if (input instanceof URL) {
    return input.href
  }

  return typeof input === 'string' ? input : String(input || '')
}

function serializeBody(body: unknown): unknown {
  if (body == null) {
    return body
  }

  if (body instanceof FormData) {
    return {
      __type: 'FormData',
      entries: Array.from(body.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : value]),
    }
  }

  if (body instanceof URLSearchParams) {
    return {
      __type: 'URLSearchParams',
      value: body.toString(),
    }
  }

  return body
}

function serializeInit(init: RequestInit | undefined): Record<string, any> | undefined {
  if (!init) {
    return undefined
  }

  const next: Record<string, any> = { ...init }
  if (next.headers && typeof (next.headers as Headers).entries === 'function') {
    next.headers = Object.fromEntries((next.headers as Headers).entries())
  }
  next.body = serializeBody(next.body)
  return next
}

function callHost(taskId: string, method: string, params: Record<string, any>) {
  const rpcId = `rpc_${++sequence}`
  return new Promise((resolve, reject) => {
    pendingRpc.set(rpcId, { resolve, reject })
    reply({
      type: 'RPC_REQUEST',
      taskId,
      rpcId,
      method,
      params,
    })
  })
}

window.addEventListener('message', async (event) => {
  const data = event.data
  if (!data || !data.__giopicDetector) {
    return
  }

  if (data.type === 'RPC_RESPONSE') {
    const pending = pendingRpc.get(data.rpcId)
    if (!pending) {
      return
    }

    pendingRpc.delete(data.rpcId)
    if (data.error) {
      pending.reject(new Error(data.error))
    } else {
      pending.resolve(data.result)
    }
    return
  }

  if (data.type !== 'EXECUTE') {
    return
  }

  const taskId = String(data.taskId || '')
  currentTaskId = taskId
  const payload = data.payload || {}
  const ctx = {
    page: payload.page,
    query: (selector: string) => callHost(taskId, 'query', { selector }),
    queryAll: (selector: string) => callHost(taskId, 'queryAll', { selector }),
    text: (selector: string) => callHost(taskId, 'text', { selector }),
    attr: (selector: string, name: string) => callHost(taskId, 'attr', { selector, name }),
    exists: (selector: string) => callHost(taskId, 'exists', { selector }),
    waitForSelector: (selector: string, timeout?: number) => callHost(taskId, 'waitForSelector', { selector, timeout }),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => callHost(taskId, 'fetch', { input: normalizeInput(input), init: serializeInit(init) }),
    fetchJson: async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await callHost(taskId, 'fetch', { input: normalizeInput(input), init: serializeInit(init) }) as any
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.body
    },
    sendMessage: (type: string, payload?: any) => callHost(taskId, 'sendMessage', { type, payload }),
    readExternalStore: (dbName: string, storeName: string) => callHost(taskId, 'readExternalStore', { dbName, storeName }),
  }

  try {
    const factory = new Function(payload.script)
    const handler = factory()
    if (typeof handler !== 'function') {
      throw new Error('Detector script must return a function')
    }

    const result = await handler(ctx, payload.input || {}, payload.state || {})
    reply({ type: 'EXECUTE_RESULT', taskId, result })
  } catch (error: any) {
    reply({
      type: 'EXECUTE_RESULT',
      taskId,
      error: error?.message || String(error),
    })
  } finally {
    currentTaskId = ''
  }
})

reply({ type: 'SANDBOX_READY' })
