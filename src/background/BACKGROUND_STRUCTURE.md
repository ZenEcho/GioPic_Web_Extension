# Background Script Architecture (v2.3.1)

## 1. 简介 (Introduction)
Background Service Worker 是浏览器扩展的“后端”，负责处理长期运行的任务、跨页面通信、系统级 API 调用（如右键菜单、通知、Web 请求拦截）。在 v2.3.1 版本中，进一步增强了 Side Panel 的状态同步与兼容性处理。

## 2. 目录结构 (Directory Structure)

```text
src/background/
├── index.ts                  # 入口文件：初始化监听器，管理生命周期，Side Panel 状态同步
├── polyfill.ts               # 兼容性补丁 (主要针对 Firefox/Chrome API 差异)
└── services/                 # 核心业务逻辑模块
    ├── actionManager.ts      # 扩展图标点击行为管理 (Popup vs Tab vs Window)
    ├── contextMenu.ts        # 右键菜单管理 ("上传图片")
    ├── desktopLink.ts        # 桌面快捷方式逻辑 (PWA/桌面版通信)
    ├── imageService.ts       # 图片下载与处理服务
    ├── messageService.ts     # 消息路由中心 (处理 Content Script 请求)
    └── notificationService.ts # 系统通知服务
```

## 3. 架构概览 (Architecture Overview)

Background 采用**服务化 (Service-based)** 架构，每个 `service` 模块负责一个特定的功能域：

| 模块 (Module) | 职责 (Responsibility) | 触发源 (Trigger) |
| :--- | :--- | :--- |
| **Lifecycle** | 扩展安装、启动、更新时的初始化逻辑 | `runtime.onInstalled` |
| **Message Router** | 处理来自 Content Script 或 Popup 的请求 | `runtime.onMessage` |
| **Context Menu** | 提供右键上传功能 | `contextMenus.onClicked` |
| **Web Request** | 拦截请求以获取图床 Token | `webRequest.onBeforeSendHeaders` |
| **Desktop Link** | 与桌面客户端/PWA 进行状态同步 | `runtime.sendMessage` |

## 4. 核心模块详解 (Core Modules)

### 4.1 入口 (`index.ts`)
*   **角色**: 引导程序。
*   **职责**:
    *   注册生命周期事件 (`onInstalled`, `onStartup`)。
    *   初始化各个服务 (`setupContextMenus`, `startAuthTokenMonitor`)。
    *   **Side Panel 兼容**: 针对 Chrome 处理 Side Panel API 的初始化，禁用点击 Action 自动打开 Panel，改为手动管理 (`setOptions`)。
    *   **状态同步**: 维护 Side Panel 的开启状态并同步到 `storage.local` (`giopic-sidepanel-open-tabs`)，以便 Content Script 感知。
    *   **点击行为**: 监听 `action.onClicked`，根据配置决定打开 Popup、新标签页还是新窗口。

### 4.2 消息服务 (`services/messageService.ts`)
*   **角色**: 路由器。
*   **职责**:
    *   监听 `browser.runtime.onMessage`。
    *   根据消息 `type` (如 `ADD_CONFIG`) 分发请求。
    *   管理 `webRequest` 监听器，用于自动捕获 Token。

### 4.3 右键菜单 (`services/contextMenu.ts`)
*   **角色**: 交互入口。
*   **职责**:
    *   创建“上传图片”上下文菜单。
    *   协调下载 (`imageService`) 和上传 (`uploader`) 流程。

## 5. 关键流程与数据流 (Key Processes & Data Flow)

### 5.1 自动 Token 获取流程
1.  **探测**: Content Script 检测到用户登录成功 -> 发送消息。
2.  **监听**: Background (`messageService`) 开启 `webRequest` 监听。
3.  **捕获**: 用户刷新页面 -> Background 截获带有 `Authorization` 的请求头。
4.  **保存**: 解析 Token -> 存入 `storage.local` -> 广播 `REFRESH_CONFIG` 消息通知 UI 刷新。

### 5.2 右键上传流程
1.  **触发**: 用户右键点击图片 -> 选择“上传图片”。
2.  **下载**: Background (`contextMenu` -> `imageService`) 下载图片到内存 (Blob)。
3.  **上传**: 调用 `uploader` 服务上传到选定的图床。
4.  **反馈**: 通过 `browser.tabs.sendMessage` 向当前 Tab 发送进度和结果，由 Content Script 显示通知。
