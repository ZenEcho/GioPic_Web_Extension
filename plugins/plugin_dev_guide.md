# GioPic 插件开发指南 (Plugin Development SDK)

GioPic 允许开发者通过 JSON 格式的插件扩展图床支持。本指南将介绍插件的结构、API 以及开发流程。

## 1. 插件结构

插件是一个单一的 `.json` 文件，包含元数据、配置输入定义和执行脚本。

```json
{
  "id": "org.example.plugin",
  "name": "Example Host",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Description of the plugin",
  "icon": "i-carbon-cloud-upload",
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
```

### 字段说明

| 字段 | 类型 | 说明 |
|Data Type|Description|
|---|---|---|
| `id` | string | 唯一标识符，建议使用反向域名格式，如 `com.example.plugin` |
| `name` | string | 显示名称 |
| `version` | string | 版本号 (语义化版本) |
| `author` | string | 作者名称 |
| `authorUrl` | string | 作者链接/联系方式 (可选) |
| `description` | string | 插件描述 |
| `homepage` | string | 插件主页/官网地址 (可选) |
| `icon` | string | 图标类名 **插件logo URL** 如 `https://example.com/logo.png` |
| `inputs` | array | 配置字段定义，用于生成用户配置界面 |
| `script` | string | 包含具体上传逻辑的 JavaScript 函数字符串 |

### Inputs 配置字段

`inputs` 数组定义了用户在配置界面需要填写的表单项。

```typescript
interface PluginInputSchema {
  name: string      // 字段名，对应 config 对象中的 key
  label: string     // 显示标签
  type: 'text' | 'password' | 'number' | 'checkbox' // 输入框类型
  required?: boolean
  default?: any
  placeholder?: string
  options?: { label: string; value: string }[] // 仅用于 select 类型 (暂未完全支持)
}
```

## 2. 脚本开发 (Script)

`script` 字段必须是一个返回异步函数的字符串。这个函数将在沙箱环境中执行。

### 函数签名

```javascript
/**
 * @param {object} config - 用户填写的配置对象 (key 为 inputs 中定义的 name)
 * @param {object} file - 待上传的文件信息
 * @param {object} ctx - 上下文对象，提供 fetch 等能力
 * @returns {Promise<string>} - 上传成功后的图片 URL
 */
async function(config, file, ctx) {
    // ... implementation
}
```

### 参数详解

#### `config`
包含用户在界面中输入的配置信息。例如，如果在 `inputs` 中定义了 `name: "token"`，则可以通过 `config.token` 获取。

#### `file`
文件对象，包含以下属性：
- `name`: 文件名 (string)
- `type`: MIME 类型 (string)
- `size`: 文件大小 (number)
- `data`: 文件的 Base64 字符串 (格式: `data:image/png;base64,...`)

**注意**: 由于沙箱限制，无法直接传递 `File` 或 `Blob` 对象。如需二进制上传，请参考下文的 Helper 使用。

#### `ctx` (Context)
提供辅助方法：

- `ctx.fetch(url, options)`: 类似原生的 `fetch`，但请求会通过扩展的 Background Service Worker 代理发出，从而**绕过 CORS 限制**。
    - **重要**: 请务必使用 `ctx.fetch` 而不是全局 `fetch`，除非你确定目标服务器支持 CORS 且不需要 Cookie。
    - **上传进度支持**: `ctx.fetch` 底层已实现为 `XMLHttpRequest`，因此支持上传进度条反馈（无需开发者额外配置）。
    - **FormData 支持**: 支持直接传递 `FormData` 对象（即使包含 File/Blob）。系统会自动序列化并在代理端重建。

### 开发模板

```javascript
return async function(config, file, ctx) {
  // 1. 将 Base64 转换为 Blob (如果 API 需要 multipart/form-data)
  const blob = await (await fetch(file.data)).blob();

  // 2. 构建 FormData
  const fd = new FormData();
  fd.append('file', blob, file.name);
  // 添加其他参数
  fd.append('token', config.token);

  // 3. 发起请求
  const res = await ctx.fetch('https://api.example.com/upload', {
    method: 'POST',
    body: fd
    // headers 会自动处理 (如 multipart/form-data boundary)
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

  // 4. 解析响应
  const data = await res.json();
  
  // 5. 返回 URL
  return data.url;
}
```

## 3. 调试与测试

由于插件运行在沙箱中，调试可能稍显复杂。

1.  **Console Log**: 在脚本中使用 `console.log`，日志会输出到扩展的 Background Page (Service Worker) 控制台，或者 Offscreen Document 的控制台中。建议在开发时打开扩展的 "背景页" 或 "Service Worker" 视图查看日志。
2.  **错误处理**: 抛出的 Error 会被捕获并在 GioPic 界面中提示给用户。请抛出包含明确错误信息的 Error 对象。

### 本地测试建议
可以先在浏览器的 Console 中模拟运行代码，将 `ctx.fetch` 替换为普通 `fetch` (需注意 CORS)。确认逻辑无误后，再封装为插件格式。

## 4. 示例

### 示例 1: JSON 请求上传

```javascript
return async function(config, file, ctx) {
    // 移除 base64 前缀
    const base64Content = file.data.split(',')[1];
    
    const res = await ctx.fetch('https://api.example.com/v1/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            image: base64Content,
            album: config.albumId
        })
    });
    
    const json = await res.json();
    if (!json.success) throw new Error(json.msg);
    return json.data.link;
}
```

### 更多示例
请参考 `plugins/examples/` 目录下的示例插件：
- `pixelpunk.json`: PixelPunk 赛博图床 (API Key, 复杂参数)

## 5. 限制与安全

- **禁止 eval**: 沙箱环境禁止使用 `eval` 或 `new Function` (除了插件加载入口)。
- **网络请求**: 只能通过 `ctx.fetch` 发起网络请求。
- **权限**: 插件无法访问浏览器 Tab、Cookie (除非目标服务器允许) 或其他扩展 API。

## 6. 分享与安装

1. 编写并测试插件。
2. 导出或保存为 `.json` 文件。
3. 直接将 JSON 文件分享给其他用户。
4. 用户在设置页面的 "图床插件管理" 中点击 "导入插件" 即可使用。

**注意**: 出于安全考虑，建议用户仅安装来自可信来源的插件。
