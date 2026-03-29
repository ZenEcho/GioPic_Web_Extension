# GioPic

[中文文档](./README.md)

GioPic is a browser extension for multi-node concurrent image uploading that enables simultaneous distribution of images to multiple object storage services, image hosting platforms, or custom service interfaces with a single operation.

[![Chrome](https://img.shields.io/badge/Chromium-chrome-blue?style=for-the-badge)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak) [![Edge](https://img.shields.io/badge/Chromium-Edge-blue?style=for-the-badge)](https://microsoftedge.microsoft.com/addons/detail/giopic/mfoecnflemgmpgkgkppbdgpmkegmooji)

## 🌟 Features

- **Multi-node Distribution**: Configure multiple "distribution nodes" to push images to all targets in parallel with a single upload.
- **Unified Plugin System**: Support both `uploader` plugins and `site-detector` plugins with the same install, enable/disable, uninstall, and marketplace flow.
- **Powerful Plugin System**: Support importing JSON plugins to extend image-host support, with uploader scripts running in a secure sandbox.
- **Plugin Manager & Online Marketplace**:
  - Review installed plugins, filter by kind/status, enable/disable them, uninstall them, and inspect full JSON payloads.
  - Install or update plugins from the online marketplace, or import local plugin files manually.
- **Extensive Provider Support**:
  - **Image Hosting Platforms**: Lsky Pro, EasyImages, Chevereto, ImgURL, Zpic, Hellohao, SM.MS, Imgur, ImgDD, OneImg
  - **Object Storage**: Alibaba Cloud OSS, Tencent Cloud COS, AWS S3
  - **Others**: GitHub Repository, Custom HTTP Interface
  - **Plugin Extensions**: Support user-defined uploader plugins
- **Built-in Image Editor**:
  - Supports cropping, annotation (text, shapes, brush), and layer management.
  - Supports filter enhancement, undo/redo, and minimap preview.
  - Deeply optimized for mobile devices with touch zoom and gesture support.
- **Convenient Upload Experience**:
  - Supports drag-and-drop, click-to-select, and clipboard paste uploads.
  - Right-click menu "GioPic Upload Image" on web pages.
- **Seamless Page Integration & Smart Adaptation**:
  - **Smart Editor Detection**: Automatically detects editors like Discuz!, Markdown, RichText, and supports manual binding of site-to-editor types.
  - **Site Detector Plugins**: Support safe page-side site recognition, config extraction, and per-site dismiss/ignore behavior through `site-detector` plugins.
  - **Enhanced Floating Ball**: Supports position memory, opacity adjustment, and auto-hiding.
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

GioPic now includes a `site-detector` plugin architecture and example detectors. After installing a matching detector plugin, visiting the target site can show a "One-Click Add" card that extracts and saves the config automatically.
![image](https://i.mji.rip/2026/01/26/e7355efe889a37dca766945154e5fff8.png)
![image](https://i.mji.rip/2026/01/26/1e99ccbcfe5f892ae40ef4fa0f47578c.png)

## 🛠️ Installation

1. Download the latest version or build from source.
2. Open Chrome/Edge browser and visit `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `dist` directory.

### Store Installation

- [Chrome Web Store](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/giopic/mfoecnflemgmpgkgkppbdgpmkegmooji)

## 📖 Usage Guide

### Adding a Storage Node

1. **Open Extension**: Click the extension icon in the browser toolbar.
2. **Add Node**: Click the "+" button in the sidebar ("Add New Interface").
3. **Select Type**: Choose your storage service provider (e.g., Lsky Pro, Alibaba Cloud OSS, Custom, etc.).
4. **Configure**: Enter the required information (API URL, Token/AccessKey, etc.).
5. **Save**: Click "Save" to complete the addition.

### One-Click Setup

After installing the matching `site-detector` plugin, the detector can recognize supported pages and guide you through one-click configuration.

### Plugin Management & Marketplace

1. Open the main UI, go to `Settings`, then enter the plugin manager page.
2. In "Installed Plugins", you can filter `uploader / site-detector`, toggle plugins, inspect config fields, and view full JSON payloads.
3. In "Online Marketplace", you can review versions, authors, download counts, then install or update plugins directly.
4. For local detector testing, you can import files from `plugins/examples/site-detectors/*.json`.

## 📚 Docs Index

- [Unified Plugin Architecture](./plugins/plugin_architecture.md)
- [Site Detector Architecture](./plugins/site_detector_plugin_architecture.md)
- [Plugin Development Guide](./plugins/plugin_dev_guide.md)
- [Plugin Marketplace Bridge API](./plugins/plugin_market_api.md)

## 🧑‍💻 Development Guide

### Prerequisites

- Node.js ^20.19.0 or >=22.12.0
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

### Extending Storage Support

You can extend storage support in two ways:

#### 1. Develop a Plugin (Recommended)

No need to modify the source code. Just write a plugin file in JSON format.

- For uploader plugins, see: [Plugin System Architecture](./plugins/plugin_architecture.md)
- For site detectors, see: [Site Detector Architecture](./plugins/site_detector_plugin_architecture.md)
- For fields and script signatures, see: [Plugin Development Guide](./plugins/plugin_dev_guide.md)
- For the online marketplace payload format, see: [Plugin Marketplace Bridge API](./plugins/plugin_market_api.md)

#### 2. Native Integration

If you want to build the provider into the extension, you need to modify the following 4 files:

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
        key: "new_host",
        label: "New Host Name",
        icon: "i-ph-cloud-duotone", // Icon class name
        color: "text-blue-600 bg-blue-100", // Theme color
        darkColor: "dark:text-blue-300 dark:bg-blue-900/30", // Dark mode theme color
        category: "custom", // Category: self-hosted, cloud, public, custom
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
