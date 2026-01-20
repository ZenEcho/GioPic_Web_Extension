# GioPic

GioPic is a multi-node image upload browser extension that can upload images to multiple providers (image hosts, object storages, GitHub and custom HTTP endpoints) at once.

[中文文档](./README_zh-CN.md)

[![Chrome](https://img.shields.io/badge/Chromium-chrome-blue?style=for-the-badge&logo=googlechrome)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 🌟 Features

- **Multi-node Delivery**: Configure multiple "distribution nodes" and push to multiple targets in parallel with a single upload.
- **Rich Providers**:
  - Lsky Pro, EasyImages, Chevereto, ImgURL, Hellohao, SM.MS, Imgur
  - Aliyun OSS, Tencent COS, AWS S3, GitHub Repository, Custom HTTP Endpoint
- **Easy Upload**:
  - Drag and drop, click to select, paste from clipboard
  - Context menu "GioPic Upload Image" on web pages
- **In-page Integration**:
  - Draggable GioPic handle on the side of web pages, click to open the upload panel in-page
  - Floating upload list shows progress in real-time, copy or inject links with one click
- **History & Batch**: Search, filter, sort, and batch delete upload records.
- **Cloud-friendly**: Built-in visual configuration for CORS & ACL of Aliyun / Tencent COS / AWS S3.
- **Multi-language & Layouts**: English / Simplified Chinese, Classic / Console / Center / Simple layouts, Dark / Light themes with various accent colors.

## 🔧 Supported Browsers

- Google Chrome (Latest Version)
- Microsoft Edge (Latest Version)

## Demo

[![](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)](https://i.mji.rip/2026/01/14/2bafa0a93887a7bb20d16454648edcd5.png)
[![](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)](https://i.mji.rip/2026/01/14/3c36933ae6050a35b25e5624c2d50517.png)
[![](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)](https://i.mji.rip/2026/01/14/399fe94db0b61260ea57b96b9936db81.png)
[![](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)](https://i.mji.rip/2026/01/20/7234d8599422e583241f0553b6928922.png)
[![](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)](https://i.mji.rip/2026/01/20/0a473ec9fadb00999173f0e462f73a82.png)
[![](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)](https://i.mji.rip/2026/01/20/86b0aebb56aba750299fd67648401456.png)

## 🛠️ Installation

1. Download the latest release or build from source.
2. Open Chrome/Edge and go to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `dist` directory.

### Store Installation

- [Chrome Web Store](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)
- [Edge Add-ons (Pending)](https://chromewebstore.google.com/detail/giopic/cjmhdboadkifegpfnflaflbjeehndmak)

## 📖 Usage Guide

### Adding Image Storage

1. **Open Extension**: Click the extension icon in the browser toolbar.
2. **Add Node**: Click the "+" button in the sidebar ("Add New Interface").
3. **Select Type**: Choose your storage provider (e.g., Lsky Pro, Aliyun OSS, Custom, etc.).
4. **Configure**: Enter the required information (API URL, Token/AccessKey, etc.).
5. **Save**: Click "Save" to finish.

### One-Click Configuration

For supported sites (like Lsky Pro, EasyImages), when you visit the site, GioPic may detect it and offer a "One-Click Add" button to automatically configure the extension.

## 🧑‍💻 Development

### Prerequisites

- Node.js >= 20.19.0
- pnpm

### Setup

```bash
pnpm install
```

### Development Mode

```bash
# Start development server (Watch mode)
pnpm dev

# For Firefox
pnpm dev:firefox
```

### Build

```bash
# Build for production
pnpm build

# For Firefox
pnpm build:firefox
```

### Test

```bash
pnpm test
```

### Adding New Image Host

To add support for a new image hosting service, you need to modify two files:

1. **Define Configuration Schema**:
   Edit `src/constants/driveSchemas.ts` to add the configuration fields required for the new image host.

   Example:
   ```typescript
   export const DRIVE_SCHEMAS: Record<string, FieldSchema[]> = {
     // ...
     new_host: [
       { key: 'apiUrl', label: 'API URL', type: 'text', required: true },
       { key: 'token', label: 'Token', type: 'password', required: true },
     ],
   }

   // Don't forget to add it to DRIVE_TYPE_OPTIONS
   export const DRIVE_TYPE_OPTIONS = [
     // ...
     { label: 'New Host Name', value: 'new_host' },
   ]
   ```

2. **Implement Upload Logic**:
   Edit `src/services/uploader.ts` to implement the upload function and register it in the main `uploadImage` function.

   Example:
   ```typescript
   // 1. Register in uploadImage
   export async function uploadImage(...) {
     switch (config.type) {
       // ...
       case 'new_host':
         return uploadNewHost(file, config, onProgress)
     }
   }

   // 2. Implement function
   async function uploadNewHost(file: File, config: any, onProgress: ProgressCallback): Promise<UploadResult> {
     // Implement upload logic using fetch or axios
     const formData = new FormData()
     formData.append('file', file)
     
     const res = await fetchUpload(config.apiUrl, formData, {
       'Authorization': config.token
     }, onProgress)

     return {
       url: res.data.url
     }
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
