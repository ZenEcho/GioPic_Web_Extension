# GioPic

[English Docs](./README_en-US.md)

GioPic 是一个支持多节点并发的浏览器图片上传扩展，一次操作即可将图片同时分发到多个对象存储、图床平台或自定义服务接口。

[![Chrome](https://img.shields.io/badge/Chromium-chrome-blue?style=for-the-badge)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak) [![Edge](https://img.shields.io/badge/Chromium-Edge-blue?style=for-the-badge)](https://microsoftedge.microsoft.com/addons/detail/giopic/mfoecnflemgmpgkgkppbdgpmkegmooji)

## 🌟 功能特性

- **多节点分发**: 配置多个「分发节点」，一次上传即可并行推送到所有目标。
- **统一插件系统**: 支持 `uploader` 上传插件与 `site-detector` 站点检测器两类插件，统一走安装、启停、卸载与市场分发流程。
- **强大的插件系统**: 支持导入 JSON 插件来扩展任意图床支持，上传脚本运行在安全的沙箱环境（Sandbox）中。
- **插件管理中心与在线插件市场**:
  - 支持查看已安装插件、按类型/状态筛选、启用/禁用、卸载、查看完整 JSON。
  - 支持从在线市场按需安装或更新插件，也支持本地导入插件文件。
- **广泛的图床支持**:
  - **图床平台**: Lsky Pro (兰空图床), EasyImages (简单图床), Chevereto, ImgURL, Zpic, Hellohao, SM.MS, Imgur, ImgDD, OneImg
  - **对象存储**: 阿里云 OSS, 腾讯云 COS, AWS S3
  - **其他**: GitHub 仓库, 自定义 HTTP 接口
  - **插件扩展**: 支持用户自定义上传插件
- **内置图片编辑器**:
  - 支持裁剪、标注（文字、形状、画笔）、图层管理。
  - 支持滤镜增强、撤销/重做、导航图预览。
  - 针对移动端进行了深度优化，支持触控缩放与操作。
- **便捷上传体验**:
  - 支持拖拽、点击选择、剪贴板粘贴上传。
  - 网页右键菜单「GioPic 上传图片」。
- **无缝网页集成与智能适配**:
  - **智能编辑器识别**: 自动识别 Discuz!、Markdown、富文本等编辑器，支持手动绑定站点与编辑器类型。
  - **站点检测器插件**: 支持通过 `site-detector` 插件在页面侧安全识别站点、提取配置，并提供“忽略本站 / 关闭当前页提示”能力。
  - **悬浮球增强**: 网页侧边悬浮球支持位置记忆、透明度调节和自动隐藏。
  - 浮动上传列表实时显示进度，支持一键复制链接或注入到页面输入框。
- **历史记录与批量管理**: 支持搜索、筛选、排序和批量删除上传记录。
- **云存储辅助工具**: 内置阿里云 OSS / 腾讯云 COS / AWS S3 的 CORS 与 ACL 可视化配置工具。
- **个性化定制**: 支持 简体中文 / English，提供 经典 / 控制台 / 中心 / 极简 等多种布局，适配深色 / 浅色模式及多种主题色。

## 🔧 支持的浏览器

- Google Chrome (最新版)
- Microsoft Edge (最新版)

## 演示

[![](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)
[![](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)
[![](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)
[![](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)
[![](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)
[![](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)

### 自动注入演示

![image](https://i.mji.rip/2026/01/26/114f48702f3d79e4527aeeb68fc45e02.gif)

### 右键上传演示

![image](https://wmimg.com/i/1550/2026/01/69707abba7d4b.gif)

### 多节点同步上传

![image](https://i.mji.rip/2026/01/26/b94ff1213587c428da665aac830e342c.png)

### 一键配置

GioPic 已提供站点检测器（`site-detector`）插件架构与示例。安装对应 detector 插件后，访问目标站点时可弹出 "一键添加" 卡片，自动提取并写入配置。
![image](https://i.mji.rip/2026/01/26/e7355efe889a37dca766945154e5fff8.png)
![image](https://i.mji.rip/2026/01/26/1e99ccbcfe5f892ae40ef4fa0f47578c.png)

## 🛠️ 安装

1. 下载最新版本或从源码构建。
2. 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`。
3. 开启 "开发者模式"。
4. 点击 "加载已解压的扩展程序"，选择 `dist` 目录。

### 商店安装

- [Chrome 应用商店](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)
- [Edge 扩展商店](https://microsoftedge.microsoft.com/addons/detail/giopic/mfoecnflemgmpgkgkppbdgpmkegmooji)

## 📖 使用指南

### 添加存储节点

1. **打开扩展**: 点击浏览器工具栏中的扩展图标。
2. **添加节点**: 点击侧边栏中的 "+" 按钮 ("添加新接口")。
3. **选择类型**: 选择您的存储服务提供商（如兰空图床、阿里云 OSS、自定义等）。
4. **配置**: 输入必要的信息（API 地址、Token/AccessKey 等）。
5. **保存**: 点击 "保存" 完成添加。

### 一键配置

安装对应的 `site-detector` 插件后，访问站点时可由检测器识别页面并引导一键添加配置。

### 插件管理与市场

1. 打开主界面后，进入「设置」并打开「图床插件管理」页。
2. 在“已安装插件”中可筛选 `uploader / site-detector / editor-adapter`、启停插件、查看配置字段和完整 JSON。
3. 在“在线插件市场”中可查看版本、作者、下载量，并直接安装或更新插件。
4. 如需本地调试 detector，可直接导入 `plugins/examples/site-detectors/*.json`。

## 📚 文档索引

- [统一插件架构](./plugins/plugin_architecture.md)
- [插件开发总览](./plugins/plugin_dev_guide.md)
- [Uploader 插件开发指南](./plugins/uploader_plugin_dev_guide.md)
- [Site Detector 插件开发指南](./plugins/site_detector_plugin_dev_guide.md)
- [Editor Adapter 插件开发指南](./plugins/editor_adapter_plugin_dev_guide.md)
- [插件市场通信协议](./plugins/plugin_market_api.md)

## 🧑‍💻 开发指南

### 前置要求

- Node.js ^20.19.0 或 >=22.12.0
- pnpm

### 初始化

```bash
pnpm install
```

### 开发模式

```bash
# 启动开发服务器（监听模式）
pnpm dev

# Firefox 开发模式
pnpm dev:firefox
```

### 构建

```bash
# 构建生产环境版本
pnpm build

# Firefox 构建
pnpm build:firefox
```

### 测试

```bash
pnpm test
```

### 扩展图床支持

您可以通过两种方式扩展图床支持：

#### 1. 开发插件 (推荐)

无需修改扩展源码，只需编写一个 JSON 格式的插件文件即可。

- 上传插件（`uploader`）详情请参阅: [Uploader 插件开发指南](./plugins/uploader_plugin_dev_guide.md)
- 站点检测器（`site-detector`）详情请参阅: [Site Detector 插件开发指南](./plugins/site_detector_plugin_dev_guide.md)
- 页面编辑器适配插件（`editor-adapter`）详情请参阅: [Editor Adapter 插件开发指南](./plugins/editor_adapter_plugin_dev_guide.md)
- 共享字段、脚本封装规则与文档导航请参阅: [插件开发总览](./plugins/plugin_dev_guide.md)
- 在线插件市场后端返回格式请参阅: [插件市场通信协议](./plugins/plugin_market_api.md)

#### 2. 原生集成 (Native)

如果您希望将图床内置到扩展中，需要修改以下 4 个文件：

1.  **更新类型定义**:
    编辑 `src/types/index.ts`:
    - 将新的类型字符串添加到 `DriveType` 联合类型中。
    - 定义一个新的 Config 接口（例如 `NewHostConfig`），继承自 `BaseConfig`。
    - 将新的 Config 接口添加到 `DriveConfig` 联合类型中。

2.  **注册节点配置**:
    编辑 `src/constants/driveSchemas.ts`:
    - 在 `DRIVE_REGISTRY` 对象中添加新条目，包含标签、图标、主题色、分类和表单配置。

    示例:

    ```typescript
    export const DRIVE_REGISTRY: Record<string, DriveRegistryItem> = {
      // ...
      new_host: {
        key: "new_host",
        label: "New Host Name",
        icon: "i-ph-cloud-duotone", // 图标类名
        color: "text-blue-600 bg-blue-100", // 主题色
        darkColor: "dark:text-blue-300 dark:bg-blue-900/30", // 暗色模式主题色
        category: "custom", // 分类: self-hosted, cloud, public, custom
        fields: [
          {
            key: "apiUrl",
            label: "config.form.apiUrl",
            type: "text",
            required: true,
          },
          {
            key: "token",
            label: "config.form.token",
            type: "password",
            required: true,
          },
        ],
      },
    };
    ```

3.  **添加多语言翻译**:
    编辑 `src/locales/zh-CN.ts` 和 `src/locales/en-US.ts`:
    - 在 `providers` 对象下添加节点名称。

    示例:

    ```typescript
    // src/locales/en-US.ts
    providers: {
      // ...
      new_host: 'New Host Name',
    }
    ```

4.  **实现上传逻辑**:
    编辑 `src/services/uploader.ts`:
    - 导入新的 Config 接口。
    - 实现上传函数（如 `uploadNewHost`）。
    - 在主 `uploadImage` 函数中注册新类型。

    示例:

    ```typescript
    // 1. 在 uploadImage 中注册
    export async function uploadImage(...) {
      switch (config.type) {
        // ...
        case 'new_host':
          return uploadNewHost(file, config as NewHostConfig, onProgress)
      }
    }

    // 2. 实现函数
    async function uploadNewHost(file: File, config: NewHostConfig, onProgress: ProgressCallback): Promise<UploadResult> {
      // Implement upload logic...
    }
    ```

## 🏗️ 技术栈

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Naive UI](https://www.naiveui.com/)
- [Pinia](https://pinia.vuejs.org/)
- [UnoCSS](https://unocss.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [WebExtension Polyfill](https://github.com/mozilla/webextension-polyfill)
