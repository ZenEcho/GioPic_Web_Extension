# GioPic Editor Adapter 插件开发指南

`editor-adapter` 负责“识别页面编辑器 + 把图片注入到页面主世界编辑器实例中”。

如果你的目标是：

- 识别某个网站正在使用什么编辑器
- 让 GioPic 上传成功后自动把图片插进编辑器
- 复用已有页面全局实例，例如 `window.editor`、`window.tinymce`、`window.CKEDITOR`

那么应该使用 `editor-adapter`。

## 1. 最小结构

```json
{
  "id": "org.example.editor-adapter.contenteditable-template",
  "kind": "editor-adapter",
  "name": "Example Contenteditable Editor Adapter",
  "version": "1.0.0",
  "author": "GioPic",
  "description": "Template for a custom page editor that uses a contenteditable root.",
  "editorAdapter": {
    "editorType": "ExampleContentEditable",
    "displayName": "Example ContentEditable",
    "detectScript": "function() { ... }",
    "injectScript": "function(url) { ... }"
  }
}
```

## 2. 必填字段

| 字段 | 说明 |
| --- | --- |
| `kind` | 固定写 `editor-adapter` |
| `editorAdapter.editorType` | 编辑器类型 ID；会写入站点编辑器绑定配置 |
| `editorAdapter.displayName` | 设置页展示名称 |
| `editorAdapter.detectScript` | 检测脚本；字段值本身必须是同步函数源码 |
| `editorAdapter.injectScript` | 注入脚本；字段值本身必须是函数源码，可为同步或异步函数 |

## 3. 脚本写法和另外两类插件不一样

`editor-adapter` 不是“脚本体”，而是“函数源码本体”。

正确写法：

```js
function() {
  return detectBySelector('.ql-editor', 'Quill', 0.9)
}
```

错误写法：

```js
return function() {
  // 不要这样写
}
```

## 4. `detectScript`

`detectScript` 必须是同步函数源码，例如：

```js
function() {
  const root = document.querySelector('.ql-editor')
  if (!root) {
    return null
  }

  return {
    type: 'Quill',
    certainty: 0.9,
    source: 'selector: .ql-editor'
  }
}
```

### 4.1 返回约定

- 返回 `null` / `false`：当前页面未命中
- 返回对象：应符合 `{ type, certainty, source }`
- `type` 建议与 `editorAdapter.editorType` 保持一致
- `certainty` 越高，自动注入时越优先
- `source` 主要用于日志和排错，建议填写

### 4.2 重要限制

- `detectScript` 必须保持同步
- 当前检测链路不会 `await detectScript()` 的结果
- 检测逻辑要尽量快，避免宽泛全局遍历

## 5. `injectScript`

`injectScript` 必须是函数源码，可同步也可异步，例如：

```js
function(url) {
  const root = document.querySelector('[contenteditable="true"]')
  if (!root) {
    return false
  }

  root.focus()
  const success = document.execCommand('insertHTML', false, '<img src="' + url + '" alt="image" />')
  if (success) {
    root.dispatchEvent(new Event('input', { bubbles: true }))
    root.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return success
}
```

### 5.1 返回约定

- 可以返回 `boolean`
- 也可以返回 `Promise<boolean>`
- 只有返回 `true` 才会被视为注入成功

### 5.2 注入成功后的宿主行为

- 页面脚本会发送 `GIOPIC_EDITOR_SUCCESS`
- 内容脚本会把当前 `hostname -> editorType` 写入 `siteEditorConfig`
- 之后同域名会优先把这个 `editorType` 作为首选适配器

## 6. 自动检测与首选编辑器规则

当前注入顺序是：

1. 如果 `siteEditorConfig` 中已有首选编辑器绑定，先尝试该 `editorType`
2. 如果首选失败或没有首选绑定，再运行所有 `detectScript`
3. 对检测结果按 `certainty` 降序排序
4. 使用得分最高的结果执行注入

因此：

- `editorType` 命名要稳定
- `detectScript` 返回的 `type` 最好不要和 `editorAdapter.editorType` 分离

## 7. 运行时 helper

`editor-adapter` 在编译时会自动注入这些 helper：

- `detectBySelector(selector, id, certainty?)`
- `detectById(elementId, id, certainty?)`
- `detectByDomain(domain, id, certainty?)`
- `handleCodeMirror5Impl(url)`

所以这些写法都是合法的：

```js
function() {
  return detectBySelector('.CodeMirror', 'CodeMirror5', 0.8)
}
```

```js
function(url) {
  return handleCodeMirror5Impl(url)
}
```

## 8. 可以访问哪些页面能力

`editor-adapter` 运行在页面主世界，因此你可以直接访问：

- 页面 DOM
- 页面挂载的全局变量
- 页面编辑器实例

常见例子：

- `window.editor`
- `window.tinymce`
- `window.CKEDITOR`
- `window.UE`

限制：

- 不能访问扩展敏感 API
- 不建议在这里做网络请求或长轮询
- 不要把 GioPic 私有能力泄漏给宿主页面

## 9. 与内置适配器、同步链路的关系

当前运行链路如下：

1. 内置适配器先由 `src/content/page/EditorInjector/adapters.ts` 转成 bundled plugins
2. Background 在初始化时把这些 bundled plugins 写入本地插件仓库
3. Content Script 从 background 拉取启用中的 `editor-adapter` 插件
4. Content Script 用 `GIOPIC_SYNC_EDITOR_PLUGINS` 把插件同步给 Page Script
5. Page Script 的 `editorAdapterRegistry` 把脚本字符串编译成最终适配器

同步时机包括：

- page bundle 初次加载后
- 页面主动发送 `GIOPIC_PAGE_READY` 后
- 插件列表刷新后
- 已注入页面再次尝试注入时

## 10. 与“网站编辑器设置”页的关系

- 设置页下拉项来自当前启用中的 `editor-adapter` 插件
- 下拉标签来自 `editorAdapter.displayName`
- 存储值来自 `editorAdapter.editorType`
- 已停用或卸载但仍被历史配置引用的 `editorType`，设置页会保留可见项，避免旧配置丢失

## 11. 示例文件建议怎么选

`plugins/examples/editor-adapters/` 目录现在有两类示例：

### 11.1 框架型编辑器

- `code-mirror5.json`
- `code-mirror6.json`
- `ckeditor4.json`
- `ckeditor5.json`
- `tiny-mce.json`
- `wang-editor.json`
- `quill.json`
- `tiptap.json`

适合直接复用框架实例探测和官方 API 注入思路。

### 11.2 站点型适配器

- `discuz.json`
- `nodeseek.json`
- `lowendtalk.json`
- `typecho.json`
- `v2-ex.json`
- `halo.json`

适合参考域名判定、页面结构定位和站点专用的注入方式。

### 11.3 模板起点

- `contenteditable_template.json`

适合从零接入一个自定义私有系统或简单 `contenteditable` 编辑器。

## 12. 常见坑

- `detectScript` 写成 `return function`，这是最常见的错误
- `detectScript` 返回的 `type` 和 `editorType` 不一致，导致首选绑定失效
- `injectScript` 注入成功却返回 `false`，导致不会回写绑定
- 只改 DOM 不派发 `input/change`，页面框架状态不同步
- 检测条件写太宽，误判别的编辑器

## 13. 调试建议

1. 先只写 `detectScript`，在目标页面确认能稳定命中
2. 再实现最小的 `injectScript`
3. 优先调用编辑器自身 API
4. 如果只能改 DOM，记得补派发事件
5. iframe 编辑器场景下，先确认编辑器实际运行在哪个 frame

## 14. 相关文档

- 总览：`plugins/plugin_dev_guide.md`
- 架构：`plugins/plugin_architecture.md`
- 市场协议：`plugins/plugin_market_api.md`
