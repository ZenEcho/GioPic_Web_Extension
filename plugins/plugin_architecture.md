# GioPic 统一插件系统架构解析

本文档描述 GioPic 在 Manifest V3 下的统一插件架构。当前系统支持两类插件：

- `kind: "uploader"`：执行上传与 uploader 配置脚本
- `kind: "site-detector"`：识别站点并提取图床配置

二者共享同一套安装、启停、卸载、市场分发模型，但运行链路不同。

## 1. 架构总览

### 1.1 统一模型

- 统一类型：`PluginKind = 'uploader' | 'site-detector'`
- 统一载荷：市场与后端都以 `PluginVersion.content` 保存和传输完整插件 JSON
- 兼容规则：历史未声明 `kind` 的插件按 `uploader` 兼容

### 1.2 双执行链路

- `uploader`：`UI/Background -> PluginRunner -> Offscreen -> Sandbox iframe`
- `site-detector`：`Content Script -> siteDetectorRunner -> SiteDetector Sandbox iframe -> TokenDetectorHost`

## 2. `uploader` 执行链（保留）

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

- `pluginRunner`：调度上传/配置任务，维护任务状态和进度
- `offscreen`：网络代理与消息中转
- `sandbox`：受限执行 `uploader.script` 与 `uploader.inputs[].dataSource.script`

### 2.3 脚本签名

- 上传脚本：`async function(config, file, ctx)`
- 配置脚本：`async function(config, ctx)`

## 3. `site-detector` 执行链（新增）

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

- `siteDetectorStorage`：持久化“本站不再提示 / 当前页关闭提示”等 detector 宿主状态
- `siteDetectorRunner`：执行 `detector.match` + `detector.detectScript`，计算最佳候选
- `siteDetectorSandbox`：在受控 iframe 中执行 detector 脚本
- `TokenDetectorHost.vue`：统一渲染 detector 文案和 `detector.actionForm`，触发 `detector.extractScript`

### 3.3 运行流程

1. 通过 background 读取本地启用的 `site-detector` 插件。
2. 先做 `detector.match` 静态筛选。
3. 进入 sandbox 执行 `detector.detectScript`，得到命中状态和评分。
4. 选择最佳 detector，渲染统一宿主 UI。
5. 用户触发后执行 `detector.extractScript`，返回 `{ config }`。
6. 通过统一消息保存配置（`ADD_CONFIG`）。

## 4. 安全边界

两类插件都遵循“脚本受限执行”的原则，但边界略有差异：

- `uploader` 脚本运行在 Offscreen 沙箱链路，网络统一经代理。
- `site-detector` 脚本运行在 content-side 受控 sandbox iframe，只能通过异步 `ctx` 访问能力。

统一限制：

- 不能直接访问 `chrome.*` / `browser.*`
- 不能直接读写扩展存储
- 不能绕过宿主随意扩展能力

`site-detector` 额外限制：

- 不能直接获取 live DOM，只能拿查询快照
- `sendMessage` 受白名单约束（当前仅开放 `GET_AUTH_STATE`）

## 5. 后端与市场对接要求

- 按 `kind` 做 schema 校验分流：
  - `uploader`：校验 `uploader.script` + `uploader.inputs`
  - `site-detector`：校验 `detector.targetDriveType` + `detector.detectScript` + `detector.extractScript`
- 完整 `content` 原样存储和分发，禁止根据摘要字段重建脚本
- 审核页需展示 detector 专属字段：`detector.match`、`detector.presentation`、`detector.actionForm`、`detector.detectScript`、`detector.extractScript`

## 6. 关键文件映射

- 统一 schema：`src/types/pluginSchema.ts`
- 统一校验：`src/utils/pluginCore.ts`
- 插件存储分流：`src/stores/plugin.ts`
- 上传执行链：`src/services/pluginRunner.ts`
- detector 执行链：`src/content/services/siteDetectorRunner.ts`
- detector 宿主 UI：`src/content/components/TokenDetectorHost.vue`
- detector 架构详解：`plugins/site_detector_plugin_architecture.md`

## 7. 延伸文档

- 开发指南：`plugins/plugin_dev_guide.md`
- 市场协议：`plugins/plugin_market_api.md`
