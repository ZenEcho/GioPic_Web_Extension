// Mock for webextension-polyfill in Electron
console.log('Using Electron Polyfill for webextension-polyfill')

const runtime = {
  getURL: (path: string) => {
    return new URL(path, window.location.origin).href
  },
  onMessage: {
    addListener: (callback: Function) => {
        // TODO: Listen to IPC 'extension-message'
    },
    removeListener: (callback: Function) => {},
  },
  sendMessage: async (message: any) => {
      console.log('Mock sendMessage:', message)
      if (window.ipcRenderer) {
        // return await window.ipcRenderer.invoke('extension-message', message)
      }
  },
  onInstalled: {
      addListener: (cb: any) => cb({ reason: 'install' })
  },
  onStartup: {
      addListener: (cb: any) => cb()
  },
  getManifest: () => ({
      version: '2.2.1',
      name: 'GioPic',
      manifest_version: 3
  }),
  id: 'electron-mock-id'
}

const storage = {
  local: {
    get: async (keys: string | string[] | null) => {
      if (keys === null) {
          const res: Record<string, any> = {}
          Object.keys(localStorage).forEach(k => {
             const val = localStorage.getItem(k)
             try {
                 if (val) res[k] = JSON.parse(val)
             } catch {
                 res[k] = val
             }
          })
          return res
      }
      if (typeof keys === 'string') {
        const val = localStorage.getItem(keys)
        return { [keys]: val ? JSON.parse(val) : undefined }
      }
      if (Array.isArray(keys)) {
        const res: Record<string, any> = {}
        keys.forEach(k => {
           const val = localStorage.getItem(k)
           if (val) res[k] = JSON.parse(val)
        })
        return res
      }
      return {}
    },
    set: async (items: Record<string, any>) => {
      Object.entries(items).forEach(([k, v]) => {
        localStorage.setItem(k, JSON.stringify(v))
      })
    },
    remove: async (keys: string | string[]) => {
        if (typeof keys === 'string') localStorage.removeItem(keys)
        else if (Array.isArray(keys)) keys.forEach(k => localStorage.removeItem(k))
    },
    clear: async () => {
        localStorage.clear()
    }
  },
  onChanged: {
      addListener: (cb: Function) => {
          // TODO: Implement storage change listener using window.addEventListener('storage', ...)
      },
      removeListener: (cb: Function) => {}
  }
}

const tabs = {
    create: async (createProperties: any) => {
        if (createProperties.url) {
            window.open(createProperties.url, '_blank')
        }
    },
    query: async () => []
}

const contextMenus = {
    create: () => {},
    removeAll: () => {},
    onClicked: { addListener: () => {} }
}

const browser = {
  runtime,
  storage,
  tabs,
  contextMenus,
  action: {
      onClicked: { addListener: () => {} },
      setPopup: () => {}
  },
  notifications: {
      create: (opts: any) => {
          new Notification(opts.title, { body: opts.message, icon: opts.iconUrl })
      }
  },
  webRequest: {
      onBeforeSendHeaders: {
          addListener: () => {},
          hasListener: () => false
      }
  },
  permissions: {
      contains: async () => true,
      request: async () => true,
      remove: async () => true
  }
}

export default browser
