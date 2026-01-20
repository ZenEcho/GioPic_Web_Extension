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
    ├── SettingsModal.vue # 设置弹窗
    └── SidebarSettings.vue # 侧边栏偏好设置
```

## 3. 架构概览 (Architecture Overview)

组件库按照**功能领域 (Functional Domain)** 进行组织，确保关注点分离：

| 模块 (Module) | 职责 (Responsibility) | 关键交互 |
| :--- | :--- | :--- |
| **Config** | 管理不同图床驱动（S3, GitHub, Custom 等）的配置表单 | 动态表单渲染、魔术变量预览、配置验证 |
| **Home** | 构建主控制台的布局与核心工作流 | 侧边栏导航、文件拖拽上传、队列管理 |
| **History** | 展示与管理历史上传记录 | 分页加载、搜索过滤、复制链接 |
| **Settings** | 管理扩展的全局偏好设置 | 界面定制、快捷键设置、语言切换 |

## 4. 核心模块详解 (Core Modules)

### 4.1 动态配置系统 (`config/DynamicConfigForm.vue`)
*   **角色**: 通用配置渲染引擎。
*   **职责**:
    *   根据 Drive Schema 动态生成表单项。
    *   **魔术变量预览**: 实时演示 `{uuid}`, `{year}` 等变量的替换结果。
    *   处理表单验证与数据绑定。

### 4.2 主界面布局 (`home/`)
*   **ConsoleSidebar**: 应用的主导航，支持折叠状态持久化 (通过 `storage.local`)。
*   **UploadZone**: 核心交互区域，支持拖拽文件、粘贴上传。
*   **UploadQueue**: 管理上传任务队列，展示进度条与状态（成功/失败）。

### 4.3 历史记录 (`history/`)
*   **HistoryGrid**: 采用虚拟滚动或分页方式展示图片预览。
*   **交互**: 支持多选删除、一键复制 Markdown/URL。

## 5. 关键流程与数据流 (Key Processes & Data Flow)

### 5.1 配置新增/编辑流程
1.  用户点击侧边栏 "Add Config" -> 打开 `ConfigModal`。
2.  选择驱动类型 -> 加载对应的 Schema。
3.  `DynamicConfigForm` 渲染表单 -> 用户输入 -> 实时预览变量。
4.  保存 -> 数据写入 `storage.local` -> 触发 `REFRESH_CONFIG` 事件。

### 5.2 文件上传流程 (Dashboard)
1.  用户拖拽文件至 `UploadZone`。
2.  `UploadQueue` 创建任务 -> 调用 `uploader` 服务。
3.  上传成功 -> 刷新 `NodeList` (如果支持列表) 或更新 `HistoryGrid`。
