# 插件市场通讯接口文档 (Plugin Market API)

本文档描述 GioPic 扩展与外部网页（如插件市场）之间的通讯协议。

这次插件系统升级后，**网页与扩展之间的消息类型没有变**，但 `plugin` / `PluginMeta` 的载荷结构已经扩展为：
- 支持更丰富的输入类型
- 支持字段级条件显示 / 禁用
- 支持配置阶段动态数据源 `dataSource`
- 支持配置脚本 `inputs[].dataSource.script`

因此，市场代码现在最重要的约束不是“消息怎么发”，而是“**安装时必须把完整插件 JSON 原样发给扩展**”。

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

### 2.1 发送安装请求

```javascript
window.postMessage({
  type: 'GIOPIC_INSTALL_PLUGIN',
  plugin: {
    id: 'org.example.plugin',
    name: 'Example Plugin',
    version: '1.1.0',
    author: 'Your Name',
    description: 'Plugin with dynamic config fields',
    icon: 'i-ph-puzzle-piece',
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
}, '*')
```

参数说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 固定为 `'GIOPIC_INSTALL_PLUGIN'` |
| `plugin` | object | 是 | 完整的插件元数据对象。请直接使用后端返回的完整 `content`，不要在市场页重新拼装残缺对象。 |

### 2.2 当前插件载荷最小要求

扩展当前安装校验至少要求以下字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 插件唯一 ID |
| `name` | 是 | 插件名 |
| `version` | 是 | 版本号 |
| `script` | 是 | 上传脚本字符串 |
| `inputs` | 是 | 必须是数组，可以为空数组，但不能缺失 |

### 2.3 `inputs` 新增能力

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
- 顶层 `script`: 上传脚本字符串，运行时签名是 `async function(config, file, ctx)`

### 2.4 市场侧必须保留的“可执行字符串”

下面两个字段都不是普通展示文本，而是运行时代码：
- `plugin.script`
- `plugin.inputs[].dataSource.script`

市场代码必须：
- 原样保留字符串内容
- 保留换行和转义
- 不要在保存 / 发布 / 安装前把它们 parse 成函数再 stringify 回去
- 不要在列表页只取摘要字段后重建安装载荷

最稳妥的做法：
- 列表接口返回完整 `content` 时，安装按钮直接发 `content`
- 详情页 / 编辑页修改后，再整体生成新的完整 `content`

### 2.5 接收安装结果

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
// plugins: Array<PluginMeta>
// error?: string
```

注意：
- `plugins` 现在返回的也是完整 `PluginMeta`
- 其中会包含新的 `inputs[].visibleWhen` / `disabledWhen` / `dataSource`
- 市场页可以据此判断本地已安装版本与服务端版本是否一致

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
- `inputs` 列表
- 是否包含 `dataSource`
- 是否包含 `visibleWhen` / `disabledWhen`
- 顶层 `script`
- 所有 `inputs[].dataSource.script`

否则审核人员会看到“这个插件只有几个表单字段”，但实际运行时还有配置阶段脚本，判断会失真。

### 4.3 在线编辑器 / 提交页

如果市场前端要支持在线创建或编辑插件，需要同步支持：
- 新输入类型：`textarea` / `number` / `switch` / `kv-pairs`
- 联动规则：`visibleWhen` / `disabledWhen`
- 动态数据源：`dataSource`
- 双脚本模型：上传脚本 + 配置脚本

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
2. 市场的插件 schema 校验要补上 `inputs` 必须为数组，以及 `dataSource.script` 的约束。
3. 详情页 / 审核页需要能看见 `visibleWhen`、`disabledWhen`、`dataSource`。
4. 如果有在线编辑器，必须支持“双脚本模型”：
   - 顶层上传脚本 `script`
   - 字段级配置脚本 `inputs[].dataSource.script`

