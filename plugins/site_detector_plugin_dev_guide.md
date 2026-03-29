# GioPic Site Detector 插件开发指南

`site-detector` 负责“识别当前网站 + 提取可落地的 GioPic 配置”，它不上传文件，而是帮助用户在目标图床后台一键生成或读取配置。

如果你的目标是：

- 打开某个图床后台时自动提示“可添加到 GioPic”
- 读取当前页面里的 token、API key、接口地址
- 借助受控表单让用户补充账号、密码或其他信息

那么应该使用 `site-detector`。

## 1. 最小结构

```json
{
  "id": "builtin.site-detector.easyimages",
  "kind": "site-detector",
  "name": "EasyImages Site Detector",
  "version": "1.0.0",
  "detector": {
    "targetDriveType": "easyimages",
    "detectScript": "return async function(ctx) { ... }",
    "extractScript": "return async function(ctx, form, state) { ... }"
  }
}
```

## 2. 必填字段

| 字段 | 说明 |
| --- | --- |
| `kind` | 固定写 `site-detector` |
| `detector.targetDriveType` | 最终要创建的 GioPic 图床类型 |
| `detector.detectScript` | 检测脚本，必须写成 `return async function(ctx) { ... }` |
| `detector.extractScript` | 提取脚本，必须写成 `return async function(ctx, form, state) { ... }` |

## 3. 可选字段

| 字段 | 用途 |
| --- | --- |
| `detector.match` | 静态匹配规则，用于预筛选和加分 |
| `detector.presentation` | 宿主 UI 文案 |
| `detector.priority` | 候选优先级 |
| `detector.actionForm` | 宿主统一表单 |

注意：

- 必须使用 `detector.*` 嵌套结构
- 旧版顶层 `targetDriveType`、`match`、`detectScript` 等字段已不再接受

## 4. `detector.match`

`detector.match` 不是装饰字段，而是 detector 执行链的第一道门槛。

### 4.1 规则结构

```ts
interface SiteDetectorMatchRule {
  domains?: string[]
  domainSuffixes?: string[]
  pathnameEquals?: string[]
  pathnameIncludes?: string[]
  urlPatterns?: string[]
}
```

### 4.2 运行语义

- 同一字段内是 OR
- 不同字段之间是 AND
- 只要写了某个字段，就必须命中
- 完全不写 `match` 时，静态分为 `0`，但仍会继续执行 `detectScript`

### 4.3 当前静态加分规则

| 字段 | 命中分数 |
| --- | --- |
| `domains` | `+120` |
| `domainSuffixes` | `+80` |
| `pathnameEquals` | `+40` |
| `pathnameIncludes` | `+20` |
| `urlPatterns` | `+25` |

## 5. `detector.priority`

最终候选得分：

```text
totalScore = (priority || 0) + matchScore + detectScriptScore
```

要点：

- `priority` 越高，越容易在多 detector 同时命中时胜出
- 支持有限数字，可为负数或小数
- 同分时保留先遍历到的插件

## 6. `detector.detectScript`

脚本字符串必须写成：

```js
return async function(ctx) {
  // return true / false / object
}
```

### 6.1 返回值归一化规则

- `true`：视为命中，`score=0`，`data={}`
- `false` / `null` / `undefined` / `0`：视为未命中
- 非对象 truthy 值：按命中处理，`score=0`
- 对象时支持：
  - `matched?: boolean`
  - `score?: number`
  - `data?: Record<string, any>`
  - `presentation?: SiteDetectorPresentation`

如果对象里没有显式 `data`，系统会把除 `matched/score/presentation` 之外的顶层字段当成 `data`。

### 6.2 检测阶段建议

- 保持轻量，优先做“快判断”
- 先用 `match` 缩小范围，再做少量 DOM 查询
- 真正有副作用的动作尽量放到 `extractScript`

## 7. `detector.extractScript`

脚本字符串必须写成：

```js
return async function(ctx, form, state) {
  return {
    config: {
      // 最终写入 GioPic 的配置
    }
  }
}
```

### 7.1 参数来源

- `ctx`：受控运行时能力
- `form`：来自 `detector.actionForm`
- `state`：来自 `detectScript` 输出并归一化后的 `data`

### 7.2 允许返回的结果

- 直接返回配置对象
- 返回 `{ config, successText }`

宿主最终会调用 `ADD_CONFIG`，其中：

- `type = detector.targetDriveType`
- 其余字段来自你返回的配置

## 8. `detector.actionForm`

支持字段类型：

- `text`
- `password`
- `checkbox`
- `select`
- `textarea`
- `number`
- `switch`

不支持的能力：

- `kv-pairs`
- `visibleWhen`
- `disabledWhen`
- `dataSource`
- `tag`

默认值策略：

- `multiple: true` => `[]`
- `checkbox` / `switch` => `false`
- 其他类型 => `''`

建议：

- `required` 目前不会自动阻止提交，最好在 `extractScript` 里自行校验
- `number` 字段最好再做一次 `Number.isFinite` 校验

## 9. `detector.presentation`

支持字段：

- `title`
- `description`
- `actionText`
- `ignoreText`
- `successText`
- `dismissText`
- `failureText`

覆盖顺序：

1. 先用插件静态 `detector.presentation`
2. 再用 `detectScript` 返回值里的 `presentation` 覆盖

## 10. detector `ctx` 能力边界

当前可用能力主要有：

- `ctx.page`
- `ctx.query(selector)`
- `ctx.queryAll(selector)`
- `ctx.text(selector)`
- `ctx.attr(selector, name)`
- `ctx.exists(selector)`
- `ctx.waitForSelector(selector, timeout)`
- `ctx.fetch(input, init)`
- `ctx.fetchJson(input, init)`
- `ctx.sendMessage(type, payload)`
- `ctx.readExternalStore(dbName, storeName)`

限制说明：

- 不能直接拿 live DOM，只能拿查询结果和快照
- `ctx.sendMessage` 受白名单限制，当前主要用于 `GET_AUTH_STATE`
- `ctx.readExternalStore` 受插件级 allowlist 限制，不能默认开放给第三方插件

## 11. 示例文件建议怎么选

| 文件 | 适合场景 |
| --- | --- |
| `plugins/examples/site-detectors/lsky.json` | 识别固定后台路径并读取 token |
| `plugins/examples/site-detectors/lsky-open.json` | 需要表单补充邮箱/密码后再换取 token |
| `plugins/examples/site-detectors/easyimages.json` | 通过后台页面和受控请求生成 token |
| `plugins/examples/site-detectors/chevereto.json` | 从页面直接读取 API key |
| `plugins/examples/site-detectors/16best.json` | 读取受控外部存储并生成自定义图床配置 |

## 12. 常见坑

- `match` 写太宽会导致误触发 detector
- `detectScript` 做太重会拖慢页面宿主体验
- `required` 不是强校验，别假设宿主会帮你拦截
- `sendMessage` 和 `readExternalStore` 不是通用能力，不能默认依赖
- 所有脚本字段都必须原样保留，不能在分发链路里改写

## 13. 调试建议

1. 先把 `match` 缩到足够窄
2. 再让 `detectScript` 稳定返回命中结果
3. 最后实现 `extractScript`
4. 如需用户输入，最后再加 `actionForm`
5. 调试日志尽量写清楚“为什么没命中”“为什么提取失败”

## 14. 相关文档

- 总览：`plugins/plugin_dev_guide.md`
- 架构：`plugins/plugin_architecture.md`
- 市场协议：`plugins/plugin_market_api.md`
