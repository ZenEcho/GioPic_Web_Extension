# GioPic

[English Docs](./README.md)

GioPic 是一个支持多节点并发的浏览器图片上传扩展，一次操作即可将图片同时分发到多个对象存储、图床平台或自定义服务接口。

[![Chrome](https://img.shields.io/badge/Chromium-chrome-blue?style=for-the-badge&logo=googlechrome)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 🌟 功能特性

- **多节点分发**: 配置多个「分发节点」，一次上传即可并行推送到所有目标。
- **广泛的图床支持**:
  - **图床平台**: Lsky Pro (兰空图床), EasyImages (简单图床), Chevereto, ImgURL, Hellohao, SM.MS, Imgur
  - **对象存储**: 阿里云 OSS, 腾讯云 COS, AWS S3
  - **其他**: GitHub 仓库, 自定义 HTTP 接口
- **便捷上传体验**:
  - 支持拖拽、点击选择、剪贴板粘贴上传。
  - 网页右键菜单「GioPic 上传图片」。
- **无缝网页集成**:
  - 网页侧边悬浮球（可拖动），点击即可在当前页面打开上传面板。
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
![image](https://i.111666.best/image/Qnzu6AP19ob4IkIth6l59k.gif)
### 右键上传演示
![image](https://wmimg.com/i/1550/2026/01/69707abba7d4b.gif)
### 多节点同步上传
![image](https://i.111666.best/image/RbI1KqI1n3EaXHiL1Xc7q6.png)
### 一键配置
对于支持的站点（如兰空图床、简单图床），当您访问该站点时，GioPic 可能会检测到并提供 "一键添加" 按钮，自动配置扩展。
![image](https://i.111666.best/image/qNQku34RLRXWki2TxepAbV.png)
![image](https://i.111666.best/image/pJFdLusLREDjVE39Bz4c50.png)


## 🛠️ 安装

1. 下载最新版本或从源码构建。
2. 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`。
3. 开启 "开发者模式"。
4. 点击 "加载已解压的扩展程序"，选择 `dist` 目录。

### 商店安装

- [Chrome Web Store](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)
- [Edge Add-ons (Pending)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 📖 使用指南

### 添加存储节点

1. **打开扩展**: 点击浏览器工具栏中的扩展图标。
2. **添加节点**: 点击侧边栏中的 "+" 按钮 ("添加新接口")。
3. **选择类型**: 选择您的存储服务提供商（如兰空图床、阿里云 OSS、自定义等）。
4. **配置**: 输入必要的信息（API 地址、Token/AccessKey 等）。
5. **保存**: 点击 "保存" 完成添加。

### 一键配置

对于支持的站点（如兰空图床、简单图床），当您访问该站点时，GioPic 可能会检测到并提供 "一键添加" 按钮，自动配置扩展。

## 🧑‍💻 开发指南

### 前置要求

- Node.js >= 20.19.0
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

### 添加新存储节点支持

添加对新存储节点的支持需要修改以下 4 个文件：

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
        key: 'new_host',
        label: 'New Host Name',
        icon: 'i-ph-cloud-duotone', // 图标类名
        color: 'text-blue-600 bg-blue-100', // 主题色
        darkColor: 'dark:text-blue-300 dark:bg-blue-900/30', // 暗色模式主题色
        category: 'custom', // 分类: self-hosted, cloud, public, custom
        fields: [
          { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true },
          { key: 'token', label: 'config.form.token', type: 'password', required: true },
        ]
      }
    }
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
