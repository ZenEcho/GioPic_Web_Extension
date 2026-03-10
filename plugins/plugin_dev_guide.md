# GioPic 插件开发指南 (Plugin Development SDK)

GioPic 允许开发者通过单个 JSON 文件扩展图床支持。插件支持两类脚本：

- 上传脚本：真正执行文件上传。
- 配置脚本（`dataSource.script`）：在填写配置时动态拉取选项、回填字段、更新提示。

本文档重点说明：

1. 每个字段在运行时的实际作用。
2. 常见字段组合的行为差异。
3. `plugins/examples` 下各示例插件的定位区别。

## 1. 插件结构

```json
{
  "id": "org.example.plugin",
  "name": "Example Host",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Upload to Example Host",
  "icon": "i-ph-cloud-arrow-up",
  "inputs": [
    {
      "name": "token",
      "label": "API Token",
      "type": "password",
      "required": true
    },
    {
      "name": "storageId",
      "label": "Storage ID",
      "type": "select",
      "filterable": true,
      "tag": true,
      "dataSource": {
        "watch": ["apiUrl", "token"],
        "required": ["apiUrl", "token"],
        "script": "return async function(config, ctx) { ... }"
      }
    }
  ],
  "script": "return async function(config, file, ctx) { ... }"
}
```

## 2. 顶层字段说明

| 字段 | 必填 | 类型 | 作用 | 备注 |
| --- | --- | --- | --- | --- |
| `id` | 是 | string | 插件唯一标识 | 建议反向域名格式，如 `dev.fileup.lsky-universal` |
| `name` | 是 | string | 插件显示名称 | 会出现在插件列表中 |
| `version` | 是 | string | 插件版本 | 建议语义化版本 |
| `author` | 否 | string | 作者名称 | 可用于展示署名 |
| `authorUrl` | 否 | string | 作者主页/联系方式 | 可选 |
| `description` | 否 | string | 插件描述 | 建议简洁说明用途 |
| `homepage` | 否 | string | 插件主页 | 可选 |
| `icon` | 否 | string | 图标类名或远程 URL | 建议稳定可访问 |
| `inputs` | 是 | array | 配置表单定义 | 数组元素为 `PluginInputSchema` |
| `script` | 是 | string | 上传脚本字符串 | 运行时必须返回 `async function(config, file, ctx)` |

### 2.1 需要“原样保留”的可执行字符串

下面两个字段不是普通文案，而是运行时代码：

- `plugin.script`
- `plugin.inputs[].dataSource.script`

在发布链路（提交、审核、安装、分发）中必须原样保留，避免 parse 后再 stringify 导致转义和换行被破坏。

## 3. Inputs 配置字段

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

### 3.1 基础字段（通用）

| 字段 | 作用 | 常见注意点 |
| --- | --- | --- |
| `name` | 字段键名 | 上传脚本中通过 `config[name]` 读取；应唯一 |
| `label` | UI 标签 | 建议可读性强 |
| `type` | 渲染控件类型 | 支持 `text/password/checkbox/select/textarea/number/switch/kv-pairs` |
| `required` | 是否必填 | 约束配置表单；脚本里仍建议兜底校验 |
| `default` | 默认值 | 类型应与字段类型匹配 |
| `options` | 静态选项 | 主要用于 `select` / 可选 `checkbox` 组选项 |
| `placeholder` | 占位提示 | 可被 `dataSource` 动态覆盖 |
| `help` | 帮助文案 | 可被 `dataSource` 动态覆盖 |

### 3.2 `select` 专属字段

这几个字段只对 `type: "select"` 有实际意义：

| 字段 | 作用 | 行为说明 |
| --- | --- | --- |
| `filterable` | 可输入关键字筛选选项 | 提升长列表可用性 |
| `clearable` | 可清空当前值 | 适合可选字段 |
| `tag` | 允许手输“选项外新值” | 适合 ID 可手填场景 |
| `multiple` | 允许多选 | 字段值会变成数组 |

> 运行时细节：当字段存在 `dataSource` 时，下拉会默认可搜索（即使未显式写 `filterable: true`）。

示例（可搜索、可清空、可手输、多选）：

```json
{
  "name": "albumIds",
  "label": "相册",
  "type": "select",
  "filterable": true,
  "clearable": true,
  "tag": true,
  "multiple": true,
  "options": [
    { "label": "旅行", "value": "1" },
    { "label": "工作", "value": "2" }
  ]
}
```

### 3.3 `visibleWhen` / `disabledWhen`

- `visibleWhen`：条件成立才显示字段。
- `disabledWhen`：条件成立时字段显示但不可编辑。

默认行为：

- 未设置 `visibleWhen` => 字段默认可见。
- 未设置 `disabledWhen` => 字段默认可编辑。

#### 条件结构

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

支持的条件键：

- `equals`
- `notEquals`
- `in`
- `notIn`
- `truthy`
- `falsy`
- `exists`
- `empty`

组合条件示例：

```json
{
  "all": [
    { "field": "authMode", "equals": "token" },
    { "field": "token", "exists": true }
  ]
}
```

联动示例：

```json
[
  {
    "name": "authMode",
    "label": "认证方式",
    "type": "select",
    "default": "token",
    "options": [
      { "label": "Token", "value": "token" },
      { "label": "Cookie", "value": "cookie" }
    ]
  },
  {
    "name": "cookie",
    "label": "Cookie",
    "type": "textarea",
    "visibleWhen": {
      "field": "authMode",
      "equals": "cookie"
    }
  },
  {
    "name": "storageId",
    "label": "存储 ID",
    "type": "select",
    "disabledWhen": {
      "field": "token",
      "empty": true
    }
  }
]
```

### 3.4 `dataSource`

`dataSource` 用于配置阶段动态拉取数据，典型场景：

- 先请求存储列表，再让用户选 `storageId`。
- 请求相册 / 文件夹 / 项目列表生成下拉选项。
- 根据接口返回自动回填字段、更新帮助文案和占位符。

```ts
interface PluginDataSource {
  watch?: string[]
  required?: string[]
  script: string
  manual?: boolean
  actionLabel?: string
}
```

字段说明：

- `watch`：监听哪些字段变化，变化时自动重新计算数据源。
- `required`：哪些字段必须先有值；未满足时不会触发加载。
- `script`：配置脚本字符串，签名固定为 `async function(config, ctx)`。
- `manual`：为 `true` 时不自动加载，仅点击按钮时执行。
- `actionLabel`：手动执行按钮文案。

> `required` 未填写时，默认等于 `watch`。

配置脚本可返回：

```ts
{
  options?: { label: string; value: any }[]
  value?: any
  patch?: Record<string, any>
  help?: string
  placeholder?: string
}
```

返回值含义：

- `options`：设置当前字段选项。
- `value`：设置当前字段值。
- `patch`：批量回填多个字段。
- `help`：动态帮助文案。
- `placeholder`：动态占位符。

也可直接返回数组，系统会自动当成 `options`。

## 4. 上传脚本

上传脚本签名：

```js
return async function(config, file, ctx) {
  // config: 用户填写的配置
  // file: { name, type, size, data }
  // ctx: 运行时辅助能力
}
```

### `ctx` 能力

- `ctx.fetch(url, options)`
  - 通过扩展代理发起请求，绕过普通页面 CORS。
  - 支持 `FormData`。
  - 返回 `{ ok, status, statusText, headers, body }`。
- `ctx.fetchJson(url, options)`
  - `ctx.fetch` 的简化版，非 2xx 直接抛错。
- `ctx.fileToBlob()`
  - 将当前上传文件转成 `Blob`。

## 5. 配置脚本 vs 上传脚本

- 配置脚本：`return async function(config, ctx) { ... }`
- 上传脚本：`return async function(config, file, ctx) { ... }`

差异：

- 配置脚本用于“填表时”动态拉取/联动。
- 上传脚本用于“上传时”处理文件并返回 URL。

## 6. 示例文件区别（`plugins/examples`）

| 文件 | 定位 | 关键字段特征 | 适用场景 |
| --- | --- | --- | --- |
| `lsky_template.json` | 兰空模板（偏单版本） | `storageId`、`albumId` 使用 `dataSource`；`filterable + tag`；`albumId` 额外 `clearable`；`isPublic` 为 `checkbox` | 快速接入常见 Lsky 接口 |
| `lsky_universal.json` | 兰空通用版（v1/v2 兼容） | 新增 `version` 控制接口分支；动态拉取策略/相册；`isPublic` 为 `switch` | 一个插件兼容多版本站点 |
| `pixelpunk.json` | 静态配置插件示例 | 无 `dataSource`、无条件联动；`accessLevel` 依赖静态 `options` | API 固定、字段稳定的平台 |
| `tg_telegram_imagebed.json` | 极简 Token 上传示例 | 仅 `apiUrl + apiKey` 两字段，无动态能力 | 快速接入 Bearer Token 上传接口 |

### 6.1 `lsky_template` 与 `lsky_universal` 核心差异

- `lsky_template` 围绕单个上传接口（`apiUrl`）组织。
- `lsky_universal` 通过 `baseUrl + version` 生成不同版本 API 路径。
- `lsky_template` 用 `checkbox` 表达公开状态。
- `lsky_universal` 用 `switch` 表达公开状态，语义更直观。

## 7. 常见坑与排查建议

- `tag: true` 后用户可输入未出现在 `options` 的值，上传脚本需兼容自由输入。
- `multiple: true` 时字段值变成数组，上传脚本不要按单值处理。
- `visibleWhen` 只控制展示，不会自动清理已填的历史值。
- `disabledWhen` 只控制编辑态，已有值仍可能保留在 `config`。
- `dataSource.script` 和顶层 `script` 的函数签名不同，混用会报错。
- 发布链路中请保留脚本字符串原样，不要二次格式化可执行代码。

## 8. 安全与限制

- 插件代码只在沙箱页面执行，不能访问 Chrome 扩展敏感 API。
- 网络请求应优先使用 `ctx.fetch` / `ctx.fetchJson`。
- 插件不应依赖 `eval`、动态注入扩展脚本或访问宿主页面 DOM。

## 9. 分享与安装

1. 编写并测试插件 JSON。
2. 直接分享该 JSON 文件。
3. 用户在 GioPic 的“插件管理”中导入使用。

建议只分发给可信用户，或通过自己的插件市场/仓库做版本管理。

## 10. 全字段回归测试脚本

为了快速验证 `PluginInputSchema` 各字段是否生效，仓库中新增了一个可直接导入的测试插件：

- `plugins/examples/plugin_field_regression_test.json`

### 10.1 覆盖范围

该脚本覆盖以下字段与能力：

- 基础字段：`name`、`label`、`type`、`required`、`default`、`options`、`placeholder`、`help`
- `select` 能力：`filterable`、`clearable`、`tag`、`multiple`
- 条件联动：`visibleWhen`、`disabledWhen`
  - 条件键：`equals`、`notEquals`、`in`、`notIn`、`truthy`、`falsy`、`exists`、`empty`
  - 组合条件：`all`
- 动态数据源：`dataSource.watch`、`dataSource.required`、`dataSource.script`、`dataSource.manual`、`dataSource.actionLabel`
- 字段类型：`text`、`password`、`checkbox`、`select`、`textarea`、`number`、`switch`、`kv-pairs`

### 10.2 使用步骤

1. 在 GioPic 插件管理中导入 `plugins/examples/plugin_field_regression_test.json`。
2. 新建一个该插件类型的配置，按下列用例逐项验证。

### 10.3 关键验收用例（建议顺序）

1. `required`：清空 `mode` 或 `apiUrl`，保存应被阻止。
2. `storageId` 自动拉取：
   - 未填 `token` 前，不应自动拉取（`required` 未满足）。
   - 填写 `token` 后，`storageId` 应自动拉取（`watch` + 自动 dataSource）。
3. `albumId` 手动拉取：
   - 即使依赖变化，也不应自动拉取（`manual: true`）。
   - 点击“手动拉取相册”按钮后才执行。
4. `select` 扩展能力：在 `customLabels` 验证可搜索、可清空、可手输、可多选。
5. `visibleWhen`：
   - `enableAdvanced=true` 时显示 `advancedNote`；`false` 时显示 `simpleNote`。
   - `token` 有值时显示 `tokenExistsField`；为空时显示 `tokenEmptyField`。
6. `disabledWhen`：
   - `mode=readonly` 时 `lockReason` 禁用。
   - `mode!=debug` 时 `debugOnlyField` 禁用。
7. 条件集合：`headers` 仅在 `enableAdvanced=true` 且 `apiUrl` 有值时显示（`all`）。
8. `number/switch/checkbox/kv-pairs`：分别验证 `retryCount`、`enableAdvanced`、`watermark`、`headers` 的值可正常保存。
9. 上传脚本回显：执行上传后，返回 URL 中 `summary` 参数应包含当前配置快照，用于确认字段最终取值。

### 10.4 预期结果判定

满足以下条件即可视为“全字段行为正常”：

- 自动 dataSource 只在依赖满足且 `manual=false` 时触发。
- 手动 dataSource 仅在按钮点击后触发。
- `watch` / `required` 对触发时机有实际约束。
- `visibleWhen` / `disabledWhen` 联动与条件语义一致。
- `select` 的 `filterable/clearable/tag/multiple` 均可观察到明显行为差异。
