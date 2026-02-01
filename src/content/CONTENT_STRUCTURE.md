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
│   ├── LinkPreview.vue       # 链接预览组件 (UI)
│   ├── TokenDetector.vue     # Token 自动获取弹窗 (UI)
│   ├── NotificationView.vue  # 全局通知组件
│   └── detectors/            # [新增] 站点专属 Token 探测器组件 (Chevereto, Lsky 等)
├── composables/              # Vue 组合式函数 (如 useDraggable)
├── page/                     # 运行在 Main World 的脚本 (Page Script)
│   ├── index.ts              # Page Script 入口
│   ├── style.css             # Page Script 样式
│   └── EditorInjector/       # [核心] 编辑器识别与注入逻辑
│       ├── adapters.ts       # 各种编辑器的适配器实现
│       ├── index.ts          # 探测与注入管理器 (Detector 类)
│       ├── meta.ts           # 编辑器元数据定义
│       └── types.ts          # 类型定义
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

### 4.2 编辑器注入系统 (`page/EditorInjector/`)
*   **Detector 类**: 核心探测器。
    *   `detect()`: 遍历适配器列表，识别当前页面的编辑器。
    *   `inject()`: 执行图片 URL 注入。支持 **Preferred Editor Type** 机制，即优先使用用户绑定或上次成功使用的编辑器类型。
    *   **自动绑定**: 注入成功后，会触发成功事件，Content Script 捕获后记录域名与编辑器的绑定关系。

### 4.3 Token 探测系统 (`components/detectors/` & `services/driveDetector.ts`)
*   **探测器组件**: 针对特定图床系统（如 Chevereto, Lsky Pro）的 Vue 组件。
*   **工作流**: 当用户访问支持的图床网站时，对应的探测器组件激活，尝试自动获取认证 Token 并提示用户保存。

### 4.4 链接预览系统 (`components/LinkPreview.vue`)
*   **功能**: 在鼠标悬停在图片链接上时展示图片预览。
*   **特性**:
    *   **智能识别**: 自动识别页面中的图片链接（a标签或文本）。
    *   **条件触发**: 支持黑名单机制（禁用特定站点预览）、Session 级别禁用。
    *   **UI 渲染**: 集成在 `ContentOverlay` 中，利用 Shadow DOM 实现样式隔离。

## 5. 关键流程与数据流 (Key Processes & Data Flow)

### 5.1 UI 注入流程
1.  浏览器加载页面 -> 运行 `src/content/index.ts`。
2.  `index.ts` 创建 `div#giopic-content-overlay` -> 附加 Shadow Root。
3.  Vue 应用 (`ContentOverlay`) 挂载到 Shadow Root 中。
4.  用户看到悬浮球，但页面 CSS 无法影响它。

### 5.2 图片上传与智能注入流程
1.  **上传**: 用户通过悬浮球上传图片 -> Background 完成上传 -> 发送 `UPLOAD_EVENT` 消息。
2.  **中转**: `content/index.ts` 收到消息 -> 读取 `storage.local` 中的 `siteEditorConfig` (获取该网站绑定的编辑器类型) -> 通过 `window.postMessage` 将配置和图片数据转发给 Main World。
3.  **注入**: `page/index.ts` (Main World) 监听到消息 -> 调用 `Detector.inject(url, preferredType)`。
    *   如果存在 `preferredType`，直接使用对应适配器注入。
    *   如果不存在，尝试自动探测并注入。
4.  **反馈**: 注入成功后，Page Script 发送成功消息 -> Content Script 更新 `siteEditorConfig` 绑定关系。
