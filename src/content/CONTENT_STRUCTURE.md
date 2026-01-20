# Content Script Architecture

## 1. 简介 (Introduction)
Content Script 是注入到宿主页面中运行的脚本，负责与页面进行交互（如上传图片、编辑器注入）以及渲染覆盖在页面上的 UI（如悬浮球）。GioPic 采用了 **双重注入策略 (Dual Injection Strategy)**，以同时满足 UI 隔离和页面 JS 交互的需求。

## 2. 目录结构 (Directory Structure)

```text
src/content/
├── index.ts                  # 入口文件：负责注入 Page Script 和挂载 Content Overlay
├── style.css                 # Content Script 全局样式
├── components/               # 运行在 Isolated World 的 UI 组件
│   ├── ContentOverlay.vue    # [核心] 统一 UI 容器，管理所有悬浮层
│   ├── WebSidebar.vue        # 悬浮球与侧边栏
│   ├── UploadList.vue        # 上传进度列表
│   ├── TokenDetector.vue     # Token 自动获取弹窗
│   └── NotificationView.vue  # 全局通知组件
├── composables/              # Vue 组合式函数 (如 useDraggable)
├── page/                     # 运行在 Main World 的脚本 (Page Script)
│   ├── index.ts              # Page Script 入口
│   └── editorInjector/       # 编辑器识别与注入逻辑
├── services/                 # 业务逻辑服务 (如 driveDetector)
└── utils/                    # 工具函数 (如 mount.ts)
```

## 3. 架构概览 (Architecture Overview)

GioPic 将注入逻辑分为两个独立的层级，分别运行在不同的上下文中：

| 层级 (Layer) | 运行环境 (Context) | 代码入口 | 可见性 | 职责 |
| :--- | :--- | :--- | :--- | :--- |
| **Content Overlay** | **Isolated World** <br> (扩展独立环境) | `src/content/index.ts` | ✅ Shadow DOM | 渲染悬浮球、侧边栏、通知等 UI。<br>特点：**样式完全隔离**，不受页面 CSS 污染。 |
| **Page Script** | **Main World** <br> (页面原生环境) | `src/content/page/index.ts` | ❌ 无可见 UI | 访问页面 JS 对象（如 `window.editor`），监听事件。<br>特点：**与页面 JS 共享作用域**。 |

## 4. 核心模块详解 (Core Modules)

### 4.1 UI 容器 (`components/ContentOverlay.vue`)
*   **角色**: 唯一的 UI 挂载点。
*   **实现**:
    *   作为所有浮层组件 (`WebSidebar`, `UploadList`, `NotificationView`) 的父容器。
    *   通过 Shadow DOM 挂载到页面 (`#giopic-content-overlay`)。
    *   管理 `pointer-events`，确保透明区域不遮挡页面操作。

### 4.2 注入引导 (`index.ts`)
*   **角色**: 启动脚本。
*   **职责**:
    1.  通过 `document.createElement('script')` 将 `page.js` 注入到 `<head>`。
    2.  调用 `mountComponent` 将 `ContentOverlay` 挂载到 Shadow Root。
    3.  监听 Background 消息 (`UPLOAD_EVENT`) 并转发给 Page Script。

### 4.3 编辑器注入 (`page/editorInjector/`)
*   **角色**: 页面逻辑探测器。
*   **职责**:
    *   自动识别页面使用的编辑器（如 Monaco, CodeMirror）。
    *   监听文件粘贴事件。
    *   处理 `GIOPIC_INJECT` 消息，将上传后的图片链接插入编辑器光标处。

## 5. 关键流程与数据流 (Key Processes & Data Flow)

### 5.1 UI 注入流程
1.  浏览器加载页面 -> 运行 `src/content/index.ts`。
2.  `index.ts` 创建 `div#giopic-content-overlay` -> 附加 Shadow Root。
3.  Vue 应用 (`ContentOverlay`) 挂载到 Shadow Root 中。
4.  用户看到悬浮球，但页面 CSS 无法影响它。

### 5.2 图片上传与注入流程
1.  **上传**: 用户通过悬浮球上传图片 -> Background 完成上传 -> 发送 `UPLOAD_EVENT` 消息。
2.  **中转**: `content/index.ts` 收到消息 -> 通过 `window.postMessage` 转发给 Main World。
3.  **注入**: `page/index.ts` (Main World) 监听到消息 -> 调用 `editorInjector` -> 将 Markdown 插入当前聚焦的编辑器。
