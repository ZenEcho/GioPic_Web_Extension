import { ipcMain, app, BrowserWindow, session, shell, nativeImage, Tray, Menu } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let tray = null;
const locales = {
  "zh-CN": {
    show: "显示主界面",
    quit: "退出",
    tooltip: "GioPic 桌面端"
  },
  "en-US": {
    show: "Show App",
    quit: "Quit",
    tooltip: "GioPic Desktop"
  }
};
let currentLocale = "zh-CN";
function getLocaleString(key) {
  return (locales[currentLocale] || locales["en-US"])[key];
}
function updateTrayMenu() {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: getLocaleString("show"),
      click: () => {
        win?.show();
      }
    },
    { type: "separator" },
    {
      label: getLocaleString("quit"),
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip(getLocaleString("tooltip"));
  tray.setContextMenu(contextMenu);
}
function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, "assets/icons/logo64.png");
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 500,
    minHeight: 600,
    icon: iconPath,
    // Set taskbar icon
    frame: false,
    // Frameless window for custom UI
    titleBarStyle: "hidden",
    // Hide native title bar
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win?.hide();
    }
    return false;
  });
}
function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, "assets/icons/logo256.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  updateTrayMenu();
  tray.on("click", () => {
    if (win?.isVisible()) {
      win.hide();
    } else {
      win?.show();
    }
  });
}
ipcMain.on("window-minimize", () => {
  win?.minimize();
});
ipcMain.on("window-maximize", () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});
ipcMain.on("window-close", () => {
  win?.close();
});
ipcMain.on("open-devtools", () => {
  console.log("[Main] Received open-devtools request");
  win?.webContents.openDevTools();
});
ipcMain.on("update-locale", (event, locale) => {
  if (locale && (locale === "zh-CN" || locale === "en-US")) {
    currentLocale = locale;
    updateTrayMenu();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    delete responseHeaders["access-control-allow-origin"];
    delete responseHeaders["access-control-allow-headers"];
    delete responseHeaders["access-control-allow-methods"];
    responseHeaders["Access-Control-Allow-Origin"] = ["*"];
    responseHeaders["Access-Control-Allow-Headers"] = ["*"];
    responseHeaders["Access-Control-Allow-Methods"] = ["*"];
    responseHeaders["Content-Security-Policy"] = ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http: file:;"];
    callback({ responseHeaders });
  });
  createWindow();
  createTray();
});
app.isQuitting = false;
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
