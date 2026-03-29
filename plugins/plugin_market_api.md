# 插件市场通讯接口文档 (Plugin Market API)

本文档描述 GioPic 扩展与外部网页（如插件市场）之间的通讯协议。

这次插件系统升级后，**网页与扩展之间的消息类型没有变**，但 `plugin` / `PluginMeta` 的载荷结构已经扩展为：
- 新增顶层 `kind`（`uploader | site-detector | editor-adapter`）
- 支持更丰富的输入类型
- 支持字段级条件显示 / 禁用
- 支持配置阶段动态数据源 `dataSource`
- 支持配置脚本 `uploader.inputs[].dataSource.script`
- 支持 detector 脚本 `detector.detectScript` / `detector.extractScript`
- 支持 editor-adapter 脚本 `editorAdapter.detectScript` / `editorAdapter.injectScript`

因此，市场代码现在最重要的约束不是“消息怎么发”，而是“**安装时必须把完整插件 JSON 原样发给扩展**”。

## 0. 扩展内置在线市场 HTTP API

除了网页与扩展之间的 `postMessage` 协议，扩展内置的插件管理页还会直接请求插件市场后端。

- 客户端实现：`src/services/pluginMarketplace.ts`
- 类型定义：`src/types/pluginMarketplace.ts`
- 默认接口前缀：`https://server.fileup.dev/api`
- 可通过环境变量覆盖：`VITE_PLUGIN_MARKET_API_BASE_URL`

### 0.1 获取市场列表

```http
GET /plugins
```

返回值当前需满足：

- 响应体是数组
- 每个条目至少包含 `id`
- 最新版本必须放在 `versions[0]`
- `versions[0].content` 必须是完整插件 JSON
- `downloads` 可为 `number | string | bigint`

扩展端会对 `versions[0].content` 再做一次本地 schema 校验；校验失败的条目不会展示在在线市场中。

### 0.2 记录安装 / 更新

```http
POST /plugins/:id/download
```

该接口用于记录扩展内置在线市场中的安装或更新动作。当前前端不依赖返回体，只要求请求成功即可。

### 0.3 网页桥接安全边界

扩展现在对“网页 -> GioPic 扩展”的插件管理桥接做了来源隔离。

- 默认只有 `https://fileup.dev/` 拥有**完整权限**
- 完整权限站点可在扩展设置中增删：`设置 -> 插件市场授权站点`
- 授权时按 `origin` 判断；例如 `https://fileup.dev/plugin/123` 最终归一化为 `https://fileup.dev`
- 只接受 `https://` 站点加入授权列表

完整权限包括：

- 安装插件：`GIOPIC_INSTALL_PLUGIN`
- 启用 / 暂停插件：`GIOPIC_TOGGLE_PLUGIN`
- 卸载插件：`GIOPIC_UNINSTALL_PLUGIN`
- 获取完整已安装插件列表：`GIOPIC_GET_INSTALLED_PLUGINS` 返回完整 `PluginMeta`

非授权站点的行为：

- `GIOPIC_GET_INSTALLED_PLUGINS` 仍可调用
- 但只会返回**基础摘要**，不会暴露 `uploader.script`、`detector.detectScript`、`detector.extractScript`、`editorAdapter.detectScript`、`editorAdapter.injectScript` 等完整运行时代码
- `GIOPIC_INSTALL_PLUGIN`、`GIOPIC_TOGGLE_PLUGIN`、`GIOPIC_UNINSTALL_PLUGIN` 都会被拒绝
- 拒绝时返回：

```json
{
  "success": false,
  "error": "Only authorized plugin market sites can perform this action"
}
```

## 1. 扩展检测

网页可以通过检查 `<html>` 根元素上的属性来判断 GioPic 扩展是否已安装并注入。

```javascript
const isGioPicInstalled = document.documentElement.hasAttribute('data-giopic-page-bundle')

if (isGioPicInstalled) {
  console.log('GioPic is installed!')
} else {
  console.log('GioPic is NOT installed.')
}
```

## 2. 安装插件协议

网页通过 `window.postMessage` 向扩展发送安装请求。

注意：

- 只有授权站点可以调用安装接口
- 非授权站点调用时会收到 `GIOPIC_INSTALL_PLUGIN_RESULT`，其中 `success = false`

### 2.1 发送安装请求

```javascript
window.postMessage({
  type: 'GIOPIC_INSTALL_PLUGIN',
  plugin: {
    id: 'org.example.plugin',
    kind: 'uploader',
    name: 'Example Plugin',
    version: '1.1.0',
    author: 'Your Name',
    description: 'Plugin with dynamic config fields',
    icon: 'i-ph-puzzle-piece',
    uploader: {
      inputs: [
        {
          name: 'token',
          label: 'API Token',
          type: 'password',
          required: true
        },
        {
          name: 'storageId',
          label: 'Storage ID',
          type: 'select',
          filterable: true,
          tag: true,
          dataSource: {
            watch: ['apiUrl', 'token'],
            required: ['apiUrl', 'token'],
            script: "return async function(config, ctx) { ... }"
          }
        }
      ],
      script: "return async function(config, file, ctx) { ... }"
    }
  }
}, '*')
```

参数说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 固定为 `'GIOPIC_INSTALL_PLUGIN'` |
| `plugin` | object | 是 | 完整的插件元数据对象。请直接使用后端返回的完整 `content`，不要在市场页重新拼装残缺对象。 |

### 2.2 当前插件载荷最小要求（按 `kind` 分流）

通用字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一 ID |
| `kind` | 建议必填 | `uploader`、`site-detector` 或 `editor-adapter`；历史缺失值按 `uploader` 兼容 |
| `name` | 是 | 插件名 |
| `version` | 是 | 版本号 |

`uploader` 必填字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `uploader` | 是 | 必须是对象 |
| `uploader.script` | 是 | 上传脚本字符串 |
| `uploader.inputs` | 是 | 必须是数组，可以为空数组，但不能缺失 |

`site-detector` 必填字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `detector` | 是 | 必须是对象 |
| `detector.targetDriveType` | 是 | 最终要写入 GioPic 的图床类型 |
| `detector.detectScript` | 是 | 检测脚本，签名 `async function(ctx)` |
| `detector.extractScript` | 是 | 提取脚本，签名 `async function(ctx, form, state)` |

`editor-adapter` 必填字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `editorAdapter` | 是 | 必须是对象 |
| `editorAdapter.editorType` | 是 | 编辑器类型 ID |
| `editorAdapter.displayName` | 是 | 编辑器显示名称 |
| `editorAdapter.detectScript` | 是 | 检测脚本字符串，字段值本身必须是函数源码 |
| `editorAdapter.injectScript` | 是 | 注入脚本字符串，字段值本身必须是函数源码 |

### 2.3 `uploader.inputs` 扩展能力

市场侧如果要做详情页、在线编辑器、审核页预览，至少要认识这些字段：

```ts
interface PluginInputSchema {
  name: string
  label: string
  type: 'text' | 'password' | 'checkbox' | 'select' | 'textarea' | 'number' | 'switch' | 'kv-pairs'
  required?: boolean
  default?: any
  options?: { label: string; value: any }[]
  placeholder?: string
  help?: string
  filterable?: boolean
  clearable?: boolean
  tag?: boolean
  multiple?: boolean
  visibleWhen?: PluginFieldConditionSchema
  disabledWhen?: PluginFieldConditionSchema
  dataSource?: {
    watch?: string[]
    required?: string[]
    script: string
    manual?: boolean
    actionLabel?: string
  }
}
```

新增点说明：
- `visibleWhen` / `disabledWhen`: 字段联动规则
- `dataSource`: 配置阶段动态数据源
- `dataSource.script`: 配置脚本字符串，运行时签名是 `async function(config, ctx)`
- `uploader.script`: 上传脚本字符串，运行时签名是 `async function(config, file, ctx)`

### 2.4 `site-detector` 结构速查

```ts
interface SiteDetectorPlugin {
  id: string
  kind: 'site-detector'
  name: string
  version: string
  detector: {
    targetDriveType: string
    detectScript: string
    extractScript: string
    match?: {
      domains?: string[]
      domainSuffixes?: string[]
      pathnameEquals?: string[]
      pathnameIncludes?: string[]
      urlPatterns?: string[]
    }
    presentation?: {
      title?: string
      description?: string
      actionText?: string
      ignoreText?: string
      successText?: string
      dismissText?: string
      failureText?: string
    }
    priority?: number
    actionForm?: Array<{
      name: string
      label: string
      type: 'text' | 'password' | 'checkbox' | 'select' | 'textarea' | 'number' | 'switch'
      required?: boolean
      default?: any
      options?: { label: string; value: any }[]
      placeholder?: string
      help?: string
      filterable?: boolean
      clearable?: boolean
      multiple?: boolean
    }>
  }
}
```

说明：
- `detector.actionForm` 是统一宿主表单，不支持 `kv-pairs`、`visibleWhen`、`disabledWhen`、`dataSource`、`tag`。
- 市场审核页建议额外标记：是否使用广泛域名匹配、是否声明 `actionForm`、是否包含 `sendMessage` 调用。

字段行为补充（运行时语义）：

- `detector.match`：先做静态预筛选；不命中则不会执行 `detector.detectScript`。命中后还会提供静态分（`domains +120`、`domainSuffixes +80`、`pathnameEquals +40`、`pathnameIncludes +20`、`urlPatterns +25`）。
- `detector.priority`：参与候选总分，公式为 `detector.priority + matchScore + detectScriptScore`，未填按 `0`。
- `detector.detectScript`：支持返回 `boolean` 或对象（`matched/score/data/presentation`）。对象中未显式给 `matched` 时默认视为命中。
- `detector.extractScript`：可返回配置对象，或 `{ config, successText }`。
- 同分决策：总分相同场景下保留先遍历到的插件。

如需完整字段说明与示例，见：

- [插件开发总览](./plugin_dev_guide.md)
- [Site Detector 插件开发指南](./site_detector_plugin_dev_guide.md)

### 2.5 市场侧必须保留的“可执行字符串”

下面这些字段都不是普通展示文本，而是运行时代码：
- `plugin.uploader.script`
- `plugin.uploader.inputs[].dataSource.script`
- `plugin.detector.detectScript`
- `plugin.detector.extractScript`
- `plugin.editorAdapter.detectScript`
- `plugin.editorAdapter.injectScript`

市场代码必须：
- 原样保留字符串内容
- 保留换行和转义
- 不要在保存 / 发布 / 安装前把它们 parse 成函数再 stringify 回去
- 不要在列表页只取摘要字段后重建安装载荷

最稳妥的做法：
- 列表接口返回完整 `content` 时，安装按钮直接发 `content`
- 详情页 / 编辑页修改后，再整体生成新的完整 `content`

### 2.6 接收安装结果

扩展处理完请求后，会通过 `postMessage` 返回结果。网页应监听 `message` 事件。

```javascript
window.addEventListener('message', (event) => {
  const data = event.data
  if (data && data.type === 'GIOPIC_INSTALL_PLUGIN_RESULT') {
    if (data.success) {
      console.log(`Plugin ${data.pluginId} installed successfully!`)
      alert('插件安装成功！')
    } else {
      console.error(`Installation failed: ${data.error}`)
      alert(`安装失败: ${data.error}`)
    }
  }
})
```

返回字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `'GIOPIC_INSTALL_PLUGIN_RESULT'` |
| `success` | boolean | 安装是否成功 |
| `error` | string | 错误信息 (如果失败) |
| `pluginId` | string | 对应请求中的插件 ID |

## 3. 其他管理协议 (更新 / 启用 / 卸载)

### 3.1 获取已安装插件列表

请求：

```javascript
window.postMessage({ type: 'GIOPIC_GET_INSTALLED_PLUGINS' }, '*')
```

响应：

```javascript
// type: 'GIOPIC_GET_INSTALLED_PLUGINS_RESULT'
// success: boolean
// plugins: Array<PluginMeta | PluginPublicSummary>
// error?: string
```

注意：

- 授权站点：`plugins` 返回完整 `PluginMeta`
- 非授权站点：`plugins` 只返回基础摘要，结构如下

```json
[
  {
    "id": "cc.pixelpunk.plugin",
    "kind": "uploader",
    "name": "PixelPunk",
    "version": "1.0.1",
    "author": "GioPic",
    "description": "上传到 PixelPunk",
    "icon": "https://pixelpunk.cc/logo.png",
    "homepage": "https://pixelpunk.cc",
    "authorUrl": "https://github.com/ZenEcho/GioPic_Web_Extension",
    "enabled": false
  }
]
```

也就是说，非授权站点：

- 可以判断插件是否安装、版本号、是否启用
- 不能读取完整运行时代码和高级配置 schema
- 不能直接拿本地完整插件对象做二次安装或代码展示

### 3.2 启用 / 禁用插件

```javascript
window.postMessage({
  type: 'GIOPIC_TOGGLE_PLUGIN',
  pluginId: 'org.example.plugin',
  enabled: true
}, '*')
```

响应：

```javascript
// type: 'GIOPIC_TOGGLE_PLUGIN_RESULT'
// success: boolean, error?: string, pluginId: string
```

注意：

- 只有授权站点可调用
- 其中 `enabled: true` 表示启动，`enabled: false` 表示暂停
- 非授权站点调用会直接返回拒绝错误

### 3.3 卸载插件

```javascript
window.postMessage({
  type: 'GIOPIC_UNINSTALL_PLUGIN',
  pluginId: 'org.example.plugin'
}, '*')
```

响应：

```javascript
// type: 'GIOPIC_UNINSTALL_PLUGIN_RESULT'
// success: boolean, error?: string, pluginId: string
```

注意：

- 只有授权站点可调用
- 非授权站点调用会直接返回拒绝错误

### 3.4 更新插件

更新插件仍然直接使用 `GIOPIC_INSTALL_PLUGIN`。

如果 `plugin.id` 已存在，扩展会：
- 用新插件内容覆盖旧版本
- 自动启用该插件

### 3.5 实时更新监听

当插件状态发生变化（无论是通过市场页面还是扩展内部），扩展会向当前页面发送更新通知。

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'GIOPIC_PLUGINS_UPDATED') {
    window.postMessage({ type: 'GIOPIC_GET_INSTALLED_PLUGINS' }, '*')
  }
})
```

## 4. 市场侧实现建议

### 4.1 列表页

列表页可以只展示摘要字段：
- `name`
- `description`
- `icon`
- `author`
- `version`
- `downloads`

但安装时不要用这些摘要字段重建插件对象，必须使用完整 `content`。

### 4.2 详情页 / 审核页

建议额外展示：
- `kind`
- `uploader`：`uploader.inputs`、`dataSource`、`visibleWhen` / `disabledWhen`、`uploader.script`
- `site-detector`：`detector.targetDriveType`、`detector.match`、`detector.presentation`、`detector.actionForm`、`detector.detectScript`、`detector.extractScript`
- `editor-adapter`：`editorAdapter.editorType`、`editorAdapter.displayName`、`editorAdapter.detectScript`、`editorAdapter.injectScript`

否则审核人员会看到“这个插件只有几个字段”，但实际运行时还有可执行脚本，判断会失真。

### 4.3 在线编辑器 / 提交页

如果市场前端要支持在线创建或编辑插件，需要同步支持：
- 新输入类型：`textarea` / `number` / `switch` / `kv-pairs`
- 联动规则：`visibleWhen` / `disabledWhen`
- 动态数据源：`dataSource`
- `kind` 分流：`uploader` / `site-detector` / `editor-adapter`
- 多脚本模型：`uploader.script`、`uploader.inputs[].dataSource.script`、`detector.detectScript`、`detector.extractScript`、`editorAdapter.detectScript`、`editorAdapter.injectScript`
- detector 专属字段：`detector.targetDriveType`、`detector.match`、`detector.presentation`、`detector.actionForm`
- editor-adapter 专属字段：`editorAdapter.editorType`、`editorAdapter.displayName`、`editorAdapter.detectScript`、`editorAdapter.injectScript`

如果暂时不做可视化编辑，至少要保留一个“完整 JSON 编辑器”。

## 5. 完整安装示例

```html
<button id="installBtn" disabled>安装到 GioPic</button>

<script>
  const btn = document.getElementById('installBtn')
  let pluginFromList = null

  if (document.documentElement.hasAttribute('data-giopic-page-bundle')) {
    btn.disabled = false
    btn.textContent = '安装到 GioPic'
  } else {
    btn.textContent = '请先安装 GioPic 扩展'
  }

  async function loadMarketplaceList() {
    const res = await fetch('/api/plugins')
    const list = await res.json()
    const item = Array.isArray(list) ? list.find(p => p.id === 'demo-plugin') : null
    pluginFromList = item?.versions?.[0]?.content || null
  }

  btn.addEventListener('click', async () => {
    if (!pluginFromList) {
      await loadMarketplaceList()
    }

    if (!pluginFromList) {
      alert('未获取到完整插件载荷')
      return
    }

    window.postMessage({
      type: 'GIOPIC_INSTALL_PLUGIN',
      plugin: pluginFromList
    }, '*')
  })

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'GIOPIC_INSTALL_PLUGIN_RESULT') {
      if (event.data.success) {
        alert('安装成功！请在扩展设置中查看。')
      } else {
        alert('安装失败：' + event.data.error)
      }
    }
  })
</script>
```

## 6. 与本次插件系统改动的耦合结论

你接下来改插件市场代码时，至少要同步这几件事：

1. 安装载荷不要再自己拼，直接发完整 `content`。
2. 校验逻辑改为按 `kind` 分流：`uploader` 校验 `uploader.script/uploader.inputs`，`site-detector` 校验 `detector.targetDriveType/detector.detectScript/detector.extractScript`，`editor-adapter` 校验 `editorAdapter.editorType/editorAdapter.displayName/editorAdapter.detectScript/editorAdapter.injectScript`。
3. 详情页 / 审核页需要能区分三类插件字段，不再只展示 uploader 字段。
4. 可执行字符串统一按“原样透传”处理：`uploader.script`、`uploader.inputs[].dataSource.script`、`detector.detectScript`、`detector.extractScript`、`editorAdapter.detectScript`、`editorAdapter.injectScript`。
5. 如果有在线编辑器，至少要支持 `kind` 切换和对应 schema 的可视化/JSON 编辑。

