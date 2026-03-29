# GioPic Uploader 插件开发指南

`uploader` 是 GioPic 插件体系里最稳定、最通用的一类插件，用于：

- 上传文件到目标图床
- 在配置阶段动态拉取下拉项、相册、策略等数据

如果你要接入一个“给我文件，我返回 URL”的图床接口，优先选 `uploader`。

## 1. 最小结构

```json
{
  "id": "org.example.plugin",
  "kind": "uploader",
  "name": "Example Host",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Upload to Example Host",
  "icon": "i-ph-cloud-arrow-up",
  "uploader": {
    "inputs": [
      {
        "name": "token",
        "label": "API Token",
        "type": "password",
        "required": true
      }
    ],
    "script": "return async function(config, file, ctx) { ... }"
  }
}
```

## 2. 顶层字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一标识 |
| `kind` | 建议必填 | 固定写 `uploader` |
| `name` | 是 | 插件显示名称 |
| `version` | 是 | 插件版本 |
| `author` / `authorUrl` | 否 | 作者信息 |
| `description` / `homepage` / `icon` | 否 | 展示信息 |
| `uploader` | 是 | uploader 运行块 |
| `uploader.inputs` | 是 | 配置表单定义，允许空数组 |
| `uploader.script` | 是 | 上传脚本字符串，必须写成 `return async function(config, file, ctx) { ... }` |

## 3. `PluginInputSchema`

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
  dataSource?: PluginDataSource
}
```

### 3.1 常用字段说明

| 字段 | 用途 | 备注 |
| --- | --- | --- |
| `name` | 配置键名 | 上传脚本通过 `config[name]` 读取 |
| `label` | UI 标签 | 建议直接面向用户 |
| `type` | 控件类型 | 支持 `text/password/checkbox/select/textarea/number/switch/kv-pairs` |
| `required` | 是否必填 | 只约束表单保存；脚本里仍建议兜底校验 |
| `default` | 默认值 | 要与字段类型匹配 |
| `options` | 静态选项 | 常用于 `select` |
| `placeholder` | 占位提示 | 可被 `dataSource` 动态覆盖 |
| `help` | 帮助文案 | 可被 `dataSource` 动态覆盖 |

### 3.2 `select` 专属能力

| 字段 | 用途 | 行为说明 |
| --- | --- | --- |
| `filterable` | 可搜索 | 长列表推荐开启 |
| `clearable` | 可清空 | 适合非必填字段 |
| `tag` | 可输入选项外新值 | 适合手填 ID |
| `multiple` | 多选 | 字段值会变成数组 |

## 4. 条件联动

`visibleWhen` 和 `disabledWhen` 都遵循统一条件模型：

```ts
interface PluginFieldCondition {
  field: string
  equals?: any
  notEquals?: any
  in?: any[]
  notIn?: any[]
  truthy?: boolean
  falsy?: boolean
  exists?: boolean
  empty?: boolean
}

interface PluginFieldConditionGroup {
  all?: PluginFieldCondition[]
  any?: PluginFieldCondition[]
}

type PluginFieldConditionSchema = PluginFieldCondition | PluginFieldConditionGroup
```

### 4.1 行为说明

- `visibleWhen`：条件成立才显示
- `disabledWhen`：条件成立时显示但不可编辑
- 未设置 `visibleWhen`：默认可见
- 未设置 `disabledWhen`：默认可编辑

### 4.2 组合条件示例

```json
{
  "all": [
    { "field": "authMode", "equals": "token" },
    { "field": "token", "exists": true }
  ]
}
```

## 5. `dataSource`

`dataSource` 用于在配置阶段动态拉取数据，例如：

- 拉取策略列表
- 拉取相册列表
- 根据用户输入自动补全字段

```ts
interface PluginDataSource {
  watch?: string[]
  required?: string[]
  script: string
  manual?: boolean
  actionLabel?: string
}
```

### 5.1 字段说明

- `watch`：监听哪些字段变化
- `required`：哪些字段必须先有值
- `script`：脚本体，必须写成 `return async function(config, ctx) { ... }`
- `manual`：为 `true` 时只在点击按钮后执行
- `actionLabel`：手动执行按钮文案

`required` 未填写时，默认等于 `watch`。

### 5.2 可返回的数据结构

```ts
{
  options?: { label: string; value: any }[]
  value?: any
  patch?: Record<string, any>
  help?: string
  placeholder?: string
}
```

也可以直接返回数组，系统会自动当成 `options`。

## 6. 上传脚本

脚本字符串必须写成：

```js
return async function(config, file, ctx) {
  // config: 用户填写的配置
  // file: { name, type, size, data }
  // ctx: 运行时能力
}
```

### 6.1 `ctx` 能力

- `ctx.fetch(url, options)`
  - 通过扩展代理发起请求
  - 支持 `FormData`
  - 返回 `{ ok, status, statusText, headers, body }`
- `ctx.fetchJson(url, options)`
  - `ctx.fetch` 的简化版
  - 非 2xx 直接抛错
- `ctx.fileToBlob()`
  - 将当前上传文件转成 `Blob`

## 7. 配置脚本 vs 上传脚本

- 配置脚本：`return async function(config, ctx) { ... }`
- 上传脚本：`return async function(config, file, ctx) { ... }`

区别：

- 配置脚本发生在“填表时”
- 上传脚本发生在“真正上传时”

## 8. 示例文件建议怎么选

| 文件 | 特点 | 适合场景 |
| --- | --- | --- |
| `plugins/examples/lsky_template.json` | 单版本 Lsky 模板，带 `dataSource` | 快速接入常见 Lsky |
| `plugins/examples/lsky_universal.json` | `v1/v2` 兼容，动态分支更多 | 一个插件兼容多版本站点 |
| `plugins/examples/pixelpunk.json` | 静态配置，字段简单 | API 固定的平台 |
| `plugins/examples/tg_telegram_imagebed.json` | 极简 token 上传 | Bearer Token 类型接口 |
| `plugins/examples/plugin_field_regression_test.json` | 覆盖全部字段行为 | 回归联动、条件和动态表单 |

## 9. 常见坑

- `multiple: true` 后字段值是数组，不要当单值处理
- `tag: true` 允许用户输入不在 `options` 中的值，上传脚本要兼容
- `visibleWhen` 只隐藏字段，不会自动清掉历史值
- `disabledWhen` 只改编辑态，历史值仍可能留在 `config`
- `dataSource.script` 和 `uploader.script` 的函数签名不同，别混用
- 所有脚本字段都必须原样保留，不要在发布链路里二次格式化

## 10. 调试建议

1. 先用最小结构把上传跑通
2. 再逐步加 `dataSource`
3. 最后补 `visibleWhen` / `disabledWhen`
4. 字段复杂时，优先导入 `plugin_field_regression_test.json` 验证宿主行为
5. 上传脚本里尽量打印明确错误，让用户能看到失败原因

## 11. 安全边界

- `uploader` 运行在 Offscreen + sandbox 链路里
- 不能直接访问页面 DOM
- 不能直接访问 `chrome.*` / `browser.*`
- 网络请求优先用 `ctx.fetch` / `ctx.fetchJson`

## 12. 相关文档

- 总览：`plugins/plugin_dev_guide.md`
- 架构：`plugins/plugin_architecture.md`
- 市场协议：`plugins/plugin_market_api.md`
