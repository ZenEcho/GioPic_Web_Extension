# GioPic

[Chinese Documentation](./README_zh-CN.md)

GioPic is a browser extension for multi-node concurrent image uploading that enables simultaneous distribution of images to multiple object storage services, image hosting platforms, or custom service interfaces with a single operation.

[![Chrome](https://img.shields.io/badge/Chromium-chrome-blue?style=for-the-badge&logo=googlechrome)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 🌟 Features

- **Multi-node Distribution**: Configure multiple "distribution nodes" to push images to all targets in parallel with a single upload.
- **Extensive Provider Support**:
  - **Image Hosting Platforms**: Lsky Pro, EasyImages, Chevereto, ImgURL, Hellohao, SM.MS, Imgur
  - **Object Storage**: Alibaba Cloud OSS, Tencent Cloud COS, AWS S3
  - **Others**: GitHub Repository, Custom HTTP Interface
- **Convenient Upload Experience**:
  - Supports drag-and-drop, click-to-select, and clipboard paste uploads.
  - Right-click menu "GioPic Upload Image" on web pages.
- **Seamless Page Integration**:
  - Draggable floating button on the side of web pages; click to open the upload panel on the current page.
  - Floating upload list shows real-time progress and supports one-click link copying or injection into page input fields.
- **History & Batch Management**: Supports searching, filtering, sorting, and batch deletion of upload records.
- **Cloud Storage Tools**: Built-in visual configuration tools for CORS and ACL for Alibaba Cloud OSS / Tencent Cloud COS / AWS S3.
- **Personalization**: Supports Simplified Chinese / English, provides multiple layouts (Classic / Console / Center / Minimalist), and adapts to Dark / Light modes and various theme colors.

## 🔧 Supported Browsers

- Google Chrome (Latest)
- Microsoft Edge (Latest)

## Demo

[![](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)
[![](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)
[![](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)
[![](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)
[![](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)
[![](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)

### Auto Injection Demo
![image](https://i.mji.rip/2026/01/26/114f48702f3d79e4527aeeb68fc45e02.gif)

### Right-click Upload Demo
![image](https://wmimg.com/i/1550/2026/01/69707abba7d4b.gif)

### Multi-node Sync Upload
![image](https://i.mji.rip/2026/01/26/b94ff1213587c428da665aac830e342c.png)

### One-Click Setup
For supported sites (e.g., Lsky Pro, EasyImages), when you visit the site, GioPic may detect it and provide a "One-Click Add" button to automatically configure the extension.
![image](https://i.mji.rip/2026/01/26/e7355efe889a37dca766945154e5fff8.png)
![image](https://i.mji.rip/2026/01/26/1e99ccbcfe5f892ae40ef4fa0f47578c.png)

## 🛠️ Installation

1. Download the latest version or build from source.
2. Open Chrome/Edge browser and visit `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `dist` directory.

### Store Installation

- [Chrome Web Store](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)
- [Edge Add-ons (Pending)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 📖 Usage Guide

### Adding a Storage Node

1. **Open Extension**: Click the extension icon in the browser toolbar.
2. **Add Node**: Click the "+" button in the sidebar ("Add New Interface").
3. **Select Type**: Choose your storage service provider (e.g., Lsky Pro, Alibaba Cloud OSS, Custom, etc.).
4. **Configure**: Enter the required information (API URL, Token/AccessKey, etc.).
5. **Save**: Click "Save" to complete the addition.

### One-Click Setup

For supported sites (e.g., Lsky Pro, EasyImages), when you visit the site, GioPic may detect it and provide a "One-Click Add" button to automatically configure the extension.

## 🧑‍💻 Development Guide

### Prerequisites

- Node.js >= 20.19.0
- pnpm

### Initialization

```bash
pnpm install
```

### Development Mode

```bash
# Start development server (watch mode)
pnpm dev

# Firefox development mode
pnpm dev:firefox
```

### Build

```bash
# Build for production
pnpm build

# Build for Firefox
pnpm build:firefox
```

### Test

```bash
pnpm test
```

### Adding Support for New Storage Providers

Adding support for a new storage provider requires modifying the following 4 files:

1.  **Update Type Definitions**:
    Edit `src/types/index.ts`:
    - Add the new type string to the `DriveType` union type.
    - Define a new Config interface (e.g., `NewHostConfig`) inheriting from `BaseConfig`.
    - Add the new Config interface to the `DriveConfig` union type.

2.  **Register Provider Configuration**:
    Edit `src/constants/driveSchemas.ts`:
    - Add a new entry to the `DRIVE_REGISTRY` object, including label, icon, theme color, category, and form configuration.

    Example:
    ```typescript
    export const DRIVE_REGISTRY: Record<string, DriveRegistryItem> = {
      // ...
      new_host: {
        key: 'new_host',
        label: 'New Host Name',
        icon: 'i-ph-cloud-duotone', // Icon class name
        color: 'text-blue-600 bg-blue-100', // Theme color
        darkColor: 'dark:text-blue-300 dark:bg-blue-900/30', // Dark mode theme color
        category: 'custom', // Category: self-hosted, cloud, public, custom
        fields: [
          { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true },
          { key: 'token', label: 'config.form.token', type: 'password', required: true },
        ]
      }
    }
    ```

3.  **Add Translations**:
    Edit `src/locales/zh-CN.ts` and `src/locales/en-US.ts`:
    - Add the provider name under the `providers` object.

    Example:
    ```typescript
    // src/locales/en-US.ts
    providers: {
      // ...
      new_host: 'New Host Name',
    }
    ```

4.  **Implement Upload Logic**:
    Edit `src/services/uploader.ts`:
    - Import the new Config interface.
    - Implement the upload function (e.g., `uploadNewHost`).
    - Register the new type in the main `uploadImage` function.

    Example:
    ```typescript
    // 1. Register in uploadImage
    export async function uploadImage(...) {
      switch (config.type) {
        // ...
        case 'new_host':
          return uploadNewHost(file, config as NewHostConfig, onProgress)
      }
    }

    // 2. Implement function
    async function uploadNewHost(file: File, config: NewHostConfig, onProgress: ProgressCallback): Promise<UploadResult> {
      // Implement upload logic...
    }
    ```

## 🏗️ Tech Stack

- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Naive UI](https://www.naiveui.com/)
- [Pinia](https://pinia.vuejs.org/)
- [UnoCSS](https://unocss.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [WebExtension Polyfill](https://github.com/mozilla/webextension-polyfill)
