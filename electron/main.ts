import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, session } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null = null

// Simple i18n support for tray
const locales = {
  'zh-CN': {
    show: '显示主界面',
    quit: '退出',
    tooltip: 'GioPic 桌面端'
  },
  'en-US': {
    show: 'Show App',
    quit: 'Quit',
    tooltip: 'GioPic Desktop'
  }
}

// Default locale
let currentLocale = 'zh-CN'

function getLocaleString(key: 'show' | 'quit' | 'tooltip') {
  return (locales[currentLocale as keyof typeof locales] || locales['en-US'])[key]
}

function updateTrayMenu() {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: getLocaleString('show'), 
      click: () => {
        win?.show()
      } 
    },
    { type: 'separator' },
    { 
      label: getLocaleString('quit'), 
      click: () => {
        app.isQuitting = true
        app.quit()
      } 
    }
  ])
  
  tray.setToolTip(getLocaleString('tooltip'))
  tray.setContextMenu(contextMenu)
}

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'assets/icons/logo64.png')
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 500,
    minHeight: 600,
    icon: iconPath, // Set taskbar icon
    frame: false, // Frameless window for custom UI
    titleBarStyle: 'hidden', // Hide native title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Forward console logs from renderer to main process terminal
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`)
  })

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Handle close event to minimize to tray instead of quitting
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win?.hide()
    }
    return false
  })
}

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'assets/icons/logo256.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  
  updateTrayMenu()
  
  tray.on('click', () => {
    if (win?.isVisible()) {
        win.hide()
    } else {
        win?.show()
    }
  })
}

// IPC handlers for window controls
ipcMain.on('window-minimize', () => {
  win?.minimize()
})

ipcMain.on('window-maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window-close', () => {
  win?.close()
})

ipcMain.on('open-devtools', () => {
  console.log('[Main] Received open-devtools request')
  win?.webContents.openDevTools()
})

// Listen for locale updates from renderer
ipcMain.on('update-locale', (event, locale) => {
  if (locale && (locale === 'zh-CN' || locale === 'en-US')) {
    currentLocale = locale
    updateTrayMenu()
  }
})


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Set up CSP and CORS bypass for image uploads
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {}
    
    // Remove existing CORS headers to avoid conflicts
    delete responseHeaders['access-control-allow-origin']
    delete responseHeaders['access-control-allow-headers']
    delete responseHeaders['access-control-allow-methods']
    
    // Add permissive CORS headers to allow uploads to any server
    responseHeaders['Access-Control-Allow-Origin'] = ['*']
    responseHeaders['Access-Control-Allow-Headers'] = ['*']
    responseHeaders['Access-Control-Allow-Methods'] = ['*']
    
    // Set Content-Security-Policy
    // Allows loading resources from any origin (needed for user-configured image hosts)
    responseHeaders['Content-Security-Policy'] = ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: file:;"]

    callback({ responseHeaders })
  })

  createWindow()
  createTray()
})

// Extend app object to track quitting state
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
app.isQuitting = false
