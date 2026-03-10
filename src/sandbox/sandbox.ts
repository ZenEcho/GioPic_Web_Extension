// @ts-nocheck
/**
 * Sandbox Script (沙箱脚本)
 * 
 * 角色: Execution Environment (执行环境)
 * 职责:
 * 1. 代码求值: 使用 new Function(script) 安全地解析用户脚本。
 * 2. 上下文注入: 向用户脚本注入 ctx 对象（包含 fetch 代理方法）。
 * 3. 请求序列化: 拦截用户脚本发起的请求，将 FormData 等复杂对象序列化为可传输的格式。
 * 4. 通信: 通过 window.parent.postMessage 与外部 (Offscreen) 通信。
 */

const notify = (data) => {
  window.parent.postMessage(data, '*')
}

const getRequestUrl = (input) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input && typeof input.url === 'string') return input.url
  return ''
}

const dataUrlToBlob = (dataUrl) => {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URL')
  }

  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    throw new Error('Malformed data URL')
  }

  const metadata = dataUrl.slice(5, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  const isBase64 = /;base64/i.test(metadata)
  const mimeType = (metadata.replace(/;base64/i, '') || 'text/plain;charset=US-ASCII').trim()

  if (isBase64) {
    const binary = atob(payload.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(payload)], { type: mimeType })
}

const dataUrlToResponse = (dataUrl) => {
  const blob = dataUrlToBlob(dataUrl)
  return new Response(blob, { status: 200, statusText: 'OK' })
}

const resolvesToCurrentDocument = (input) => {
  if (!input) {
    return true
  }

  try {
    return new URL(input, window.location.href).href === window.location.href
  } catch {
    return false
  }
}

window.addEventListener('message', async (event) => {
  const { data } = event
  if (!data) return

  if (data.type === 'PING') {
    notify({ type: 'SANDBOX_READY' })
    return
  }

  if (data.type !== 'EXECUTE') return

  const { id, script, inputs, file, mode = 'upload' } = data

  try {
    const fileDataUrl = typeof file?.data === 'string' && file.data.startsWith('data:') ? file.data : ''

    const safeFetch = async (input, init) => {
      const requestUrl = getRequestUrl(input)
      const shouldUseFileData = !!fileDataUrl && resolvesToCurrentDocument(requestUrl)

      if (requestUrl.startsWith('data:')) {
        return dataUrlToResponse(requestUrl)
      }

      if (!input && fileDataUrl) {
        return dataUrlToResponse(fileDataUrl)
      }

      if (shouldUseFileData) {
        return dataUrlToResponse(fileDataUrl)
      }

      try {
        return await fetch(input, init)
      } catch (err) {
        if (shouldUseFileData) {
          return dataUrlToResponse(fileDataUrl)
        }
        throw err
      }
    }

    const proxyFetch = async (url, options = {}) => {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7)

        const handleResponse = (e) => {
          if (e.data?.type === 'FETCH_RESULT' && e.data?.requestId === requestId) {
            window.removeEventListener('message', handleResponse)
            if (e.data.error) reject(new Error(e.data.error))
            else resolve(e.data.response)
          }
        }
        window.addEventListener('message', handleResponse)

        if (options.body instanceof FormData) {
          const entries = []
          for (const [key, value] of options.body.entries()) {
            entries.push([key, value])
          }
          options.body = {
            __type: 'FormData',
            entries
          }
        }

        notify({ type: 'FETCH_REQUEST', requestId, url, options, taskId: id })
      })
    }

    const ctx = {
      mode,
      fetch: proxyFetch,
      fetchJson: async (url, options = {}) => {
        const response = await proxyFetch(url, options)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.body
      },
      fileToBlob: () => {
        if (!fileDataUrl) {
          throw new Error('File data URL is missing')
        }
        return dataUrlToBlob(fileDataUrl)
      }
    }

    const factory = new Function('fetch', script)
    const handler = factory(safeFetch)

    if (typeof handler !== 'function') {
      throw new Error('Plugin script must return a function')
    }

    const result = mode === 'config'
      ? await handler(inputs, ctx)
      : await handler(inputs, file, ctx)

    notify({ type: 'EXECUTE_RESULT', id, result })
  } catch (err) {
    console.error('[Sandbox] Execution error:', err)
    notify({ type: 'EXECUTE_RESULT', id, error: err?.message || String(err) })
  }
})

notify({ type: 'SANDBOX_READY' })
