# GioPic 统一插件系统架构解析

本文档描述 GioPic 在 Manifest V3 下的统一插件架构。当前系统支持三类插件：

- `kind: "uploader"`：执行上传与 uploader 配置脚本
- `kind: "site-detector"`：识别站点并提取图床配置
- `kind: "editor-adapter"`：识别页面编辑器并在主世界执行图片注入

三者共享同一套安装、启停、卸载、市场分发模型，但运行链路、脚本执行方式和安全边界不同。

## 1. 架构总览

### 1.1 统一模型

- 统一类型：`PluginKind = 'uploader' | 'site-detector' | 'editor-adapter'`
- 统一载荷：市场与后端都以完整 `content` 保存和传输插件 JSON
- 统一校验：安装、导入、同步都经过 `validatePlugin` 按 `kind` 分流
- 兼容规则：历史未声明 `kind` 的插件按 `uploader` 兼容
- 严格规则：`site-detector` 必须使用 `detector.*` 嵌套结构，旧版顶层 runtime 字段不再接受

### 1.2 三条执行链

- `uploader`：`UI / Background -> PluginRunner -> Offscreen -> Sandbox iframe`
- `site-detector`：`Content Script -> siteDetectorRunner -> SiteDetector Sandbox iframe -> TokenDetectorHost`
- `editor-adapter`：`Content Script -> Page Script(EditorInjector) -> editorAdapterRegistry -> 页面编辑器实例`

### 1.3 三类脚本的求值方式

- `uploader.script`、`uploader.inputs[].dataSource.script`：按 `new Function('fetch', script)` 执行，因此脚本字符串内部要 `return async function(...) { ... }`
- `detector.detectScript`、`detector.extractScript`：按 `new Function(payload.script)` 执行，因此脚本字符串内部也要 `return async function(...) { ... }`
- `editorAdapter.detectScript`、`editorAdapter.injectScript`：按 `return (${script})` 直接求值，因此字段值本身必须就是函数源码，不能再包一层 `return`

## 2. `uploader` 执行链

### 2.1 核心目录

```text
src/
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.ts
├── sandbox/
│   ├── index.html
│   └── sandbox.ts
└── services/
    └── pluginRunner.ts
```

### 2.2 关键职责

- `pluginRunner.ts`：调度上传与配置脚本执行，维护任务超时与结果回传
- `offscreen/*`：充当受控中转环境
- `sandbox.ts`：执行 `uploader.script` 与 `dataSource.script`

### 2.3 运行摘要

1. UI 或 background 触发上传/配置动作。
2. `pluginRunner` 读取本地启用的 `uploader` 插件。
3. 脚本在 offscreen sandbox 中执行，并通过 `ctx.fetch/fetchJson/fileToBlob` 获得受控能力。
4. 返回上传结果 URL 或配置阶段动态数据。

## 3. `site-detector` 执行链

### 3.1 核心目录

```text
src/
├── content/components/
│   └── TokenDetectorHost.vue
├── content/services/
│   ├── siteDetectorRunner.ts
│   ├── siteDetectorSandbox.ts
│   └── siteDetectorStorage.ts
└── sandbox/
    ├── site-detector.html
    └── site-detector.ts
```

### 3.2 关键职责

- `siteDetectorRunner.ts`：加载启用中的 detector 插件，执行静态匹配与脚本评分
- `siteDetectorSandbox.ts` / `sandbox/site-detector.ts`：在受控 iframe 中执行 detector 脚本
- `siteDetectorStorage.ts`：持久化“忽略本站 / 当前页关闭”等宿主状态
- `TokenDetectorHost.vue`：统一渲染 detector 文案和 `actionForm`

### 3.3 运行流程

1. Content Script 从 background 读取本地启用的 `site-detector` 插件。
2. 先执行 `detector.match` 做静态预筛选和静态加分。
3. 命中的候选进入 sandbox 执行 `detector.detectScript`。
4. 宿主按总分选择最佳 detector 并展示统一 UI。
5. 用户确认后执行 `detector.extractScript`，返回 `{ config }` 或扩展结果对象。
6. 宿主最终通过统一消息链保存配置（`ADD_CONFIG`）。

### 3.4 受控能力边界

- detector 脚本只能通过 `ctx.query/queryAll/text/attr/exists/waitForSelector` 访问页面信息
- `ctx.sendMessage` 受白名单限制，当前主要用于 `GET_AUTH_STATE`
- `ctx.readExternalStore` 受插件级 allowlist 限制，不能默认开放给第三方 detector

## 4. `editor-adapter` 执行链

### 4.1 核心目录

```text
src/
├── content/
│   ├── index.ts
│   └── utils/injector.ts
├── content/page/EditorInjector/
│   ├── adapters.ts
│   ├── index.ts
│   ├── meta.ts
│   ├── pluginRuntime.ts
│   └── types.ts
├── components/settings/
│   ├── PluginManagerPanel.vue
│   └── SiteEditorSettings.vue
└── constants/
    └── bundledPlugins.ts
```

### 4.2 关键职责

- `adapters.ts`：内置编辑器适配器实现
- `pluginRuntime.ts`：把内置适配器转换为 bundled plugins，并把已同步插件编译为运行时适配器
- `content/index.ts`：从 background 拉取启用中的 `editor-adapter` 插件，并通过 `GIOPIC_SYNC_EDITOR_PLUGINS` 同步给 Page Script
- `EditorInjector/index.ts`：执行检测、选择首选适配器、完成注入并回传成功事件
- `SiteEditorSettings.vue`：维护站点与 `editorType` 的绑定关系

### 4.3 运行流程

1. 内置适配器先被转换为 `editor-adapter` 插件，并作为 bundled plugins 参与初始化。
2. Background 通过 `seedBundledPluginsOnce(BUNDLED_PLUGINS, 'giopic-bundled-plugins-v3')` 一次性写入本地插件仓库。
3. Content Script 注入 page bundle 后，从 background 读取已安装插件并筛出启用中的 `editor-adapter`。
4. Content Script 在以下时机同步插件列表：page bundle 初次加载完成、页面发出 `GIOPIC_PAGE_READY`、插件列表刷新、以及已注入页面再次尝试注入时。
5. Page Script 的 `editorAdapterRegistry` 编译脚本字符串，生成最终可执行的适配器列表。
6. 用户触发图片注入时，系统先尝试 `preferredType`，没有则自动检测所有适配器并按 `certainty` 选择最佳结果。
7. 注入成功后，Page Script 发出 `GIOPIC_EDITOR_SUCCESS`，Content Script 将当前 `hostname -> editorType` 持久化到 `siteEditorConfig`。

### 4.4 与旧式硬编码适配器的关系

- 旧的内置适配器并没有被删除，而是被“插件化”后继续使用
- 因此 bundled 内置适配器和用户手动导入的 `editor-adapter` 在管理层是同一套数据结构
- 设置页和插件管理页都直接消费这套统一插件模型

## 5. 安全边界

三类插件都遵循“受控执行”的原则，但边界不同：

- `uploader`：运行在 offscreen sandbox 中，不能访问宿主页面 DOM，网络走代理能力
- `site-detector`：运行在 content-side sandbox iframe 中，只能通过受控 `ctx` 访问页面和宿主能力
- `editor-adapter`：运行在页面主世界，可以访问页面 DOM 和页面全局编辑器实例，但不能访问扩展敏感 API

统一限制：

- 不能直接访问 `chrome.*` / `browser.*`
- 不能直接读写扩展存储
- 不能假设所有运行时能力都无条件开放
- 市场与安装链路必须原样保留可执行字符串，不能重建脚本源码

## 6. 后端与市场对接要求

- 按 `kind` 做 schema 校验分流：
  - `uploader`：校验 `uploader.script` 与 `uploader.inputs`
  - `site-detector`：校验 `detector.targetDriveType`、`detector.detectScript`、`detector.extractScript`
  - `editor-adapter`：校验 `editorAdapter.editorType`、`editorAdapter.displayName`、`editorAdapter.detectScript`、`editorAdapter.injectScript`
- 市场和后端必须存储完整 `content`，不能依赖摘要字段反推运行时对象
- 详情页 / 审核页 / 管理页需要按 `kind` 展示不同字段，而不是只展示 uploader 字段
- 插件列表过滤、管理页脚本标签、站点编辑器设置都已经扩展到第三类插件

## 7. 关键文件映射

- 统一 schema：`src/types/pluginSchema.ts`
- 统一校验与归一化：`src/utils/pluginCore.ts`
- 插件存储与分类视图：`src/stores/plugin.ts`
- 上传执行链：`src/services/pluginRunner.ts`
- detector 执行链：`src/content/services/siteDetectorRunner.ts`
- editor-adapter 运行时：`src/content/page/EditorInjector/pluginRuntime.ts`
- editor-adapter 同步入口：`src/content/index.ts`
- 站点编辑器绑定：`src/components/settings/SiteEditorSettings.vue`
- bundled 插件入口：`src/constants/bundledPlugins.ts`
- 插件管理面板：`src/components/settings/PluginManagerPanel.vue`

## 8. 延伸文档

- 开发总览：`plugins/plugin_dev_guide.md`
- uploader 指南：`plugins/uploader_plugin_dev_guide.md`
- site-detector 指南：`plugins/site_detector_plugin_dev_guide.md`
- editor-adapter 指南：`plugins/editor_adapter_plugin_dev_guide.md`
- 市场协议：`plugins/plugin_market_api.md`
