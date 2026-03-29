# GioPic 插件开发总览

这份文档不再承载所有细节，而是作为 GioPic 插件体系的总入口。

当前统一插件系统支持三类插件：

- `kind: "uploader"`：上传插件，负责上传文件与动态配置拉取
- `kind: "site-detector"`：站点识别插件，负责识别当前页面并提取图床配置
- `kind: "editor-adapter"`：页面编辑器适配插件，负责识别页面编辑器并把图片注入到主世界编辑器实例

## 1. 先看哪份文档

| 目标 | 文档 |
| --- | --- |
| 先了解整套运行模型 | `plugins/plugin_architecture.md` |
| 开发上传插件 | `plugins/uploader_plugin_dev_guide.md` |
| 开发站点识别插件 | `plugins/site_detector_plugin_dev_guide.md` |
| 开发页面编辑器适配插件 | `plugins/editor_adapter_plugin_dev_guide.md` |
| 对接在线插件市场或网页桥接安装 | `plugins/plugin_market_api.md` |

## 2. 三类插件对比

| `kind` | 主要用途 | 运行位置 | 核心脚本字段 | 典型返回结果 |
| --- | --- | --- | --- | --- |
| `uploader` | 上传文件、拉取动态配置 | `Offscreen -> sandbox iframe` | `uploader.script`、`uploader.inputs[].dataSource.script` | 图片 URL 或动态表单数据 |
| `site-detector` | 识别站点、提取图床配置 | `Content Script -> detector sandbox iframe` | `detector.detectScript`、`detector.extractScript` | `{ config }` 或带提示文案的结果 |
| `editor-adapter` | 识别页面编辑器、执行页面注入 | `Page Script / Main World` | `editorAdapter.detectScript`、`editorAdapter.injectScript` | 检测结果或注入是否成功 |

## 3. 共享顶层字段

所有插件都共享同一套基础元数据：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一标识，建议用反向域名格式 |
| `kind` | 建议必填 | 插件类型：`uploader`、`site-detector`、`editor-adapter` |
| `name` | 是 | 插件显示名称 |
| `version` | 是 | 插件版本，建议语义化版本 |
| `author` | 否 | 作者名称 |
| `authorUrl` | 否 | 作者主页或联系方式 |
| `description` | 否 | 插件说明 |
| `homepage` | 否 | 插件主页 |
| `icon` | 否 | 图标类名或远程图标 URL |
| `enabled` | 否 | 持久化后的启停状态；安装后一般由宿主写入 |

兼容规则：

- 历史未声明 `kind` 的旧插件会按 `uploader` 归一化。
- `site-detector` 旧版顶层 runtime 字段写法已废弃，必须改成 `detector.*` 嵌套结构。
- 安装、导入、市场分发都会经过统一的 `validatePlugin` 按 `kind` 分流校验。

## 4. 可执行字符串必须原样保留

下面这些字段不是普通文本，而是运行时代码：

- `plugin.uploader.script`
- `plugin.uploader.inputs[].dataSource.script`
- `plugin.detector.detectScript`
- `plugin.detector.extractScript`
- `plugin.editorAdapter.detectScript`
- `plugin.editorAdapter.injectScript`

发布链路里必须：

- 原样保留字符串内容
- 保留换行、空格、转义和缩进
- 不要先 parse 成函数再 stringify 回去
- 不要在市场列表页只保留摘要字段后重建安装载荷

## 5. 三类脚本的封装方式不一样

这是最容易写错的一点。

### 5.1 `uploader` / `site-detector`

这两类脚本会按“脚本体”执行，因此字符串内部必须自己 `return` 出目标函数。

示例：

```js
return async function(config, file, ctx) {
  // uploader.script
}
```

```js
return async function(ctx, form, state) {
  // detector.extractScript
}
```

### 5.2 `editor-adapter`

`editor-adapter` 会按“函数源码本体”直接求值，因此字段值本身必须就是函数表达式，不能再包一层 `return`。

示例：

```js
function() {
  return detectBySelector('.ql-editor', 'Quill', 0.9)
}
```

```js
async function(url) {
  // editorAdapter.injectScript
  return true
}
```

## 6. 文档与示例目录建议阅读顺序

### 6.1 如果你要开发上传插件

1. 看 `plugins/uploader_plugin_dev_guide.md`
2. 再看 `plugins/examples/` 下的 uploader 示例
3. 需要联动字段回归时，导入 `plugins/examples/plugin_field_regression_test.json`

### 6.2 如果你要开发站点识别插件

1. 看 `plugins/site_detector_plugin_dev_guide.md`
2. 再看 `plugins/examples/site-detectors/*.json`
3. 最后结合 `plugins/plugin_architecture.md` 理解 detector 宿主链路

### 6.3 如果你要开发编辑器适配插件

1. 看 `plugins/editor_adapter_plugin_dev_guide.md`
2. 再看 `plugins/examples/editor-adapters/*.json`
3. 如需理解同步链路，再看 `plugins/plugin_architecture.md`

## 7. 当前内置与宿主行为要点

- 内置编辑器适配器已经被插件化，并会作为 bundled plugins 在初始化时写入本地插件仓库。
- bundled 插件迁移键当前是 `giopic-bundled-plugins-v3`。
- 内容脚本会在页面脚本加载完成、页面主动发出 `GIOPIC_PAGE_READY`、插件刷新、以及重复注入场景下同步启用中的 `editor-adapter` 插件到 Page Script。
- “网站编辑器设置”页下拉项来自当前启用中的 `editor-adapter` 插件：`displayName` 用于展示，`editorType` 用于持久化绑定。

## 8. 新建插件时的最小检查清单

- 先确定自己属于哪一种 `kind`
- 脚本字段的封装方式写对
- 只使用该运行链路允许的能力
- 插件 JSON 能通过本地导入校验
- 在目标页面或目标图床上完成一次真实验证
- 分发前确认安装链路传的是完整 `content`

## 9. 相关文档

- 架构总览：`plugins/plugin_architecture.md`
- 市场协议：`plugins/plugin_market_api.md`
- 上传插件指南：`plugins/uploader_plugin_dev_guide.md`
- 站点识别插件指南：`plugins/site_detector_plugin_dev_guide.md`
- 编辑器适配插件指南：`plugins/editor_adapter_plugin_dev_guide.md`
