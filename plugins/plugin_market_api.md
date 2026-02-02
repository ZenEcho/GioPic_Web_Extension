# 插件市场通讯接口文档 (Plugin Market API)

本文档描述了 GioPic 扩展与外部网页（如插件市场）之间的通讯协议。通过此协议，网页可以直接触发扩展的插件安装流程。

## 1. 扩展检测

网页可以通过检查 `<html>` 根元素上的属性来判断 GioPic 扩展是否已安装并注入。

```javascript
const isGioPicInstalled = document.documentElement.hasAttribute('data-giopic-page-bundle');

if (isGioPicInstalled) {
  console.log('GioPic is installed!');
} else {
  console.log('GioPic is NOT installed.');
}
```

## 2. 安装插件协议

网页通过 `window.postMessage` 向扩展发送安装请求。

### 2.1 发送安装请求

**消息格式**:

```javascript
window.postMessage({
  type: 'GIOPIC_INSTALL_PLUGIN',
  plugin: {
    // 完整的插件 JSON 对象 (符合 PluginMeta 定义)
    id: "org.example.plugin",
    name: "Example Plugin",
    version: "1.0.0",
    script: "...",
    // ... 其他字段
  }
}, '*');
```

**参数说明**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 是 | 固定为 `'GIOPIC_INSTALL_PLUGIN'` |
| `plugin` | object | 是 | 完整的插件元数据对象，必须包含 `id`, `name`, `version`, `script` 等核心字段。详见 [插件开发指南](./plugin_dev_guide.md)。 |

### 2.2 接收安装结果

扩展处理完请求后，会通过 `postMessage` 返回结果。网页应监听 `message` 事件。

**消息格式**:

```javascript
window.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'GIOPIC_INSTALL_PLUGIN_RESULT') {
    if (data.success) {
      console.log(`Plugin ${data.pluginId} installed successfully!`);
      alert('插件安装成功！');
    } else {
      console.error(`Installation failed: ${data.error}`);
      alert(`安装失败: ${data.error}`);
    }
  }
});
```

**返回字段说明**:

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | 固定为 `'GIOPIC_INSTALL_PLUGIN_RESULT'` |
| `success` | boolean | 安装是否成功 |
| `error` | string | 错误信息 (如果失败) |
| `pluginId` | string | 对应请求中的插件 ID |

## 3. 其他管理协议 (更新/启用/卸载)

除了安装，扩展还支持网页对插件进行状态管理。

### 3.1 获取已安装插件列表

**请求**:
```javascript
window.postMessage({ type: 'GIOPIC_GET_INSTALLED_PLUGINS' }, '*');
```

**响应**:
```javascript
// type: 'GIOPIC_GET_INSTALLED_PLUGINS_RESULT'
// plugins: Array<PluginMeta>
```

### 3.2 启用/禁用插件

**请求**:
```javascript
window.postMessage({ 
  type: 'GIOPIC_TOGGLE_PLUGIN',
  pluginId: 'org.example.plugin',
  enabled: true // or false
}, '*');
```

**响应**:
```javascript
// type: 'GIOPIC_TOGGLE_PLUGIN_RESULT'
// success: boolean, error?: string, pluginId: string
```

### 3.3 卸载插件

**请求**:
```javascript
window.postMessage({ 
  type: 'GIOPIC_UNINSTALL_PLUGIN',
  pluginId: 'org.example.plugin'
}, '*');
```

**响应**:
```javascript
// type: 'GIOPIC_UNINSTALL_PLUGIN_RESULT'
// success: boolean, error?: string, pluginId: string
```

### 3.4 更新插件

更新插件直接使用 **安装协议** (`GIOPIC_INSTALL_PLUGIN`) 即可。如果 `plugin.id` 已存在，扩展会自动覆盖旧版本并强制启用。

### 3.5 实时更新监听

当插件状态发生变化（无论是通过市场页面还是扩展内部），扩展会向当前页面发送更新通知。网页可以监听此事件来刷新状态。

**事件通知**:
```javascript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'GIOPIC_PLUGINS_UPDATED') {
    console.log('Plugin list updated, refreshing...');
    // 收到通知后，建议重新获取插件列表
    window.postMessage({ type: 'GIOPIC_GET_INSTALLED_PLUGINS' }, '*');
  }
});
```

## 4. 示例代码

以下是一个完整的“一键安装”按钮实现示例：

```html
<button id="installBtn" disabled>安装到 GioPic</button>

<script>
  const btn = document.getElementById('installBtn');
  
  // 1. 检测扩展是否安装
  if (document.documentElement.hasAttribute('data-giopic-page-bundle')) {
    btn.disabled = false;
    btn.textContent = '安装到 GioPic';
  } else {
    btn.textContent = '请先安装 GioPic 扩展';
  }

  // 2. 绑定点击事件
  btn.addEventListener('click', () => {
    const pluginData = {
      id: "com.example.demo",
      name: "Demo Plugin",
      version: "1.0.0",
      description: "A demo plugin from market",
      script: "return async function(config, file, ctx) { return 'https://example.com/image.png'; }"
    };

    window.postMessage({
      type: 'GIOPIC_INSTALL_PLUGIN',
      plugin: pluginData
    }, '*');
  });

  // 3. 监听结果
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'GIOPIC_INSTALL_PLUGIN_RESULT') {
      if (event.data.success) {
        alert('安装成功！请在扩展设置中查看。');
      } else {
        alert('安装失败：' + event.data.error);
      }
    }
  });
</script>
```
