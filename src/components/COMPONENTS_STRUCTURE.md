# Components Architecture

## 1. 简介 (Introduction)
`src/components` 目录包含了 GioPic 主界面（Console/Dashboard）的核心 UI 组件。这些组件主要运行在 Extension 的 Popup、Side Panel 或 Options 页面中，基于 Vue 3 + UnoCSS 构建，负责处理核心的图床管理、文件上传、历史记录和全局设置。

## 2. 目录结构 (Directory Structure)

```text
src/components/
├── config/               # 图床配置相关组件
│   ├── AclConfig.vue     # 访问控制列表 (ACL) 配置
│   ├── ConfigModal.vue   # 配置弹窗容器
│   ├── CorsConfig.vue    # CORS 代理设置
│   ├── DriveSelector.vue # [核心] 图床驱动选择器 (分类展示)
│   ├── DynamicConfigForm.vue # [核心] 动态配置表单 (支持魔术变量预览)
│   └── KvInput.vue       # 键值对输入组件 (Header/Body配置)
├── history/              # 上传历史记录模块
│   ├── HistoryGrid.vue   # 历史记录网格视图
│   ├── HistoryHeader.vue # 历史记录头部 (搜索/过滤)
│   └── HistoryToolbar.vue# 历史记录工具栏
├── home/                 # 主界面 (Dashboard) 布局组件
│   ├── node/             # 文件节点管理
│   │   └── NodeList.vue  # 文件/文件夹列表展示
│   ├── onboarding/       # 新手引导
│   │   └── OnboardingOverlay.vue
│   ├── queue/            # 上传队列
│   │   └── UploadQueue.vue
│   ├── sidebar/          # 侧边栏导航
│   │   ├── ClassicSidebar.vue # 经典版侧边栏
│   │   ├── ConsoleSidebar.vue # [核心] 控制台版侧边栏 (支持折叠)
│   │   └── ImportConfigModal.vue # 配置导入弹窗
│   └── upload/           # 上传交互
│       └── UploadZone.vue # 拖拽上传区域
└── settings/             # 全局设置
    ├── SettingsModal.vue # 设置弹窗 (集成各子设置)
    ├── SidebarSettings.vue # 侧边栏 (Content Script) 偏好设置
    └── SiteEditorSettings.vue # [核心] 网站-编辑器自动绑定管理
```

## 3. 架构概览 (Architecture Overview)

组件库按照**功能领域 (Functional Domain)** 进行组织，确保关注点分离：

| 模块 (Module) | 职责 (Responsibility) | 关键交互 |
| :--- | :--- | :--- |
| **Config** | 管理不同图床驱动（S3, GitHub, Custom 等）的配置表单 | 动态表单渲染、魔术变量预览、配置验证、驱动选择 |
| **Home** | 构建主控制台的布局与核心工作流 | 侧边栏导航、文件拖拽上传、队列管理 |
| **History** | 展示与管理历史上传记录 | 分页加载、搜索过滤、复制链接 |
| **Settings** | 管理扩展的全局偏好设置 | 界面定制、快捷键设置、语言切换、编辑器自动绑定管理 |

## 4. 核心模块详解 (Core Modules)

### 4.1 动态配置系统 (`config/`)
*   **DriveSelector.vue**: 提供分类（自托管、云存储、公共图床）的驱动选择界面，优化用户体验。
*   **DynamicConfigForm.vue**:
    *   根据 Drive Schema 动态生成表单项。
    *   **魔术变量预览**: 实时演示 `{uuid}`, `{year}` 等变量的替换结果。
    *   处理表单验证与数据绑定。

### 4.2 主界面布局 (`home/`)
*   **ConsoleSidebar**: 应用的主导航，支持折叠状态持久化 (通过 `storage.local`)。
*   **UploadZone**: 核心交互区域，支持拖拽文件、粘贴上传。
*   **UploadQueue**: 管理上传任务队列，展示进度条与状态（成功/失败）。

### 4.3 全局设置 (`settings/`)
*   **SettingsModal**: 统一的设置入口，集成通用设置、外观设置等。
*   **SiteEditorSettings**:
    *   管理“域名-编辑器”的绑定关系。
    *   支持手动添加/删除绑定规则。
    *   配合 Content Script 实现编辑器的自动识别与精准注入。

## 5. 关键流程与数据流 (Key Processes & Data Flow)

### 5.1 配置新增/编辑流程
1.  用户点击侧边栏 "Add Config" -> 打开 `ConfigModal`。
2.  `DriveSelector` 展示可用驱动 -> 用户选择驱动类型。
3.  `DynamicConfigForm` 渲染对应 Schema 的表单 -> 用户输入 -> 实时预览变量。
4.  保存 -> 数据写入 `storage.local` -> 触发 `REFRESH_CONFIG` 事件。

### 5.2 网站编辑器绑定流程
1.  Content Script 成功注入图片到某网站编辑器 -> 自动记录“域名-编辑器类型”到 `storage.local`。
2.  用户打开设置 -> `SiteEditorSettings` 读取并展示绑定列表。
3.  用户手动修改/删除绑定 -> 更新 `storage.local`。
4.  下次访问该网站 -> Content Script 优先使用绑定的编辑器适配器。
