# 插件市场通讯协议（M5）

本文档定义 Web 插件市场与 GioPic 浏览器扩展之间的通讯协议，并补充和后端插件载荷的耦合约束。

## 1. 模块定位

本模块关注两件事：

1. `window.postMessage` 消息协议本身（安装/更新/启停/卸载/同步）。
2. 安装时插件载荷必须来自后端完整 `content`，不能由前端摘要字段重建。

前端参考页面：`src/frontend/pages/PluginMarketplace.vue`

## 2. 与后端的核心耦合

市场安装链路：

1. 前端调用 `GET /api/plugins`。
2. 使用返回的 `versions[0].content` 作为安装载荷。
3. 调用 `POST /api/plugins/:id/download` 记录下载。
4. 通过 `window.postMessage` 发给扩展安装。

关键约束：

- `content` 是可执行配置载荷，不只是展示 JSON。
- 必须原样保留以下脚本字符串：
  - 顶层 `plugin.script`
  - 字段级 `plugin.inputs[].dataSource.script`
- 不要 parse 成函数再 stringify 回去。
- 不要用卡片摘要字段（`name/description/icon/version`）反向拼装安装对象。

## 3. 扩展检测

```javascript
const isGioPicInstalled = document.documentElement.hasAttribute('data-giopic-page-bundle')
```

## 4. 消息协议

## 4.1 安装插件（同时用于更新）

请求：`GIOPIC_INSTALL_PLUGIN`

```javascript
window.postMessage({
  type: 'GIOPIC_INSTALL_PLUGIN',
  plugin: fullPluginContent
}, '*')
```

`plugin` 最低要求字段：

- `id`
- `name`
- `version`
- `script`
- `inputs`（必须是数组，可为空）

响应：`GIOPIC_INSTALL_PLUGIN_RESULT`

- `success: boolean`
- `pluginId?: string`
- `error?: string`

## 4.2 获取已安装列表

请求：`GIOPIC_GET_INSTALLED_PLUGINS`

响应：`GIOPIC_GET_INSTALLED_PLUGINS_RESULT`

- `success: boolean`
- `plugins?: PluginMeta[]`
- `error?: string`

## 4.3 启用/禁用插件

请求：`GIOPIC_TOGGLE_PLUGIN`

- `pluginId: string`
- `enabled: boolean`

响应：`GIOPIC_TOGGLE_PLUGIN_RESULT`

## 4.4 卸载插件

请求：`GIOPIC_UNINSTALL_PLUGIN`

- `pluginId: string`

响应：`GIOPIC_UNINSTALL_PLUGIN_RESULT`

## 4.5 状态变更通知

通知：`GIOPIC_PLUGINS_UPDATED`

建议收到后立即触发一次 `GIOPIC_GET_INSTALLED_PLUGINS` 重新同步。

## 5. 插件 schema 关注点

市场端至少应识别下列字段（用于详情、审核预览、编辑器）：

- `inputs[].visibleWhen`
- `inputs[].disabledWhen`
- `inputs[].dataSource.watch`
- `inputs[].dataSource.required`
- `inputs[].dataSource.script`
- `inputs[].dataSource.manual`
- `inputs[].dataSource.actionLabel`

这部分字段直接影响扩展运行时行为，忽略会导致“页面显示逻辑”和“扩展实际执行逻辑”不一致。

## 6. 市场侧实现建议

1. 列表页可用摘要字段展示，但安装必须使用完整 `content`。
2. 详情页应展示脚本与动态字段能力（含 `dataSource`、联动规则）。
3. 若提供在线编辑，必须支持“双脚本模型”：上传脚本 + 配置脚本。
4. 若暂不做可视化编辑，至少保留完整 JSON 编辑能力。

## 7. 参考代码片段

```javascript
async function installFromMarketplace(pluginId) {
  const list = await api.get('/plugins')
  const plugin = list.data.find((p) => p.id === pluginId)
  const fullPluginContent = plugin?.versions?.[0]?.content

  if (!fullPluginContent) {
    throw new Error('Missing full plugin content')
  }

  await api.post(`/plugins/${pluginId}/download`).catch(() => undefined)

  window.postMessage({
    type: 'GIOPIC_INSTALL_PLUGIN',
    plugin: fullPluginContent,
  }, '*')
}
```

## 8. 验收清单

- [ ] 扩展未安装时，市场页可明确识别并提示。
- [ ] 安装动作使用完整 `content`，不是摘要对象。
- [ ] 安装后能收到 `GIOPIC_INSTALL_PLUGIN_RESULT`。
- [ ] 收到 `GIOPIC_PLUGINS_UPDATED` 后可自动同步本地安装状态。
- [ ] 详情/审核视图能看见 `dataSource` 与字段联动规则。
