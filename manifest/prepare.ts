// 开发与构建时调用的脚本

// 引入 fs-extra 模块，用于文件操作
import fsExtra from 'fs-extra';
const { ensureDir, readFile, writeFile } = fsExtra;
// 引入 chokidar 模块，用于监听文件变化
import chokidar from 'chokidar';
// 从 utils.js 文件中引入 isDev, port 和 r 方法
import { isDev, port, r } from './utils.js';
import { getManifest } from './manifest.js';


// 输出 index.html 文件
async function indexOut() {
    await ensureDir(`dist`);
    let data = await readFile(`index.html`, 'utf-8');
    data = data
        .replace('"/src/main.ts"', `"http://localhost:${port}/src/main.ts"`)
        .replace('<div id="app"></div>', `<div id="app">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background-color: #ffffff; height: 100vh; display: flex; justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; overflow: hidden; color: #333; }
        .container { text-align: center; position: relative; z-index: 2; }
        .loader { position: relative; width: 100px; height: 100px; margin: 0 auto 35px; }
        .loader-circle { position: absolute; width: 100%; height: 100%; border: 3px solid transparent; border-top-color: #3498db; border-radius: 50%; animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite; }
        .loader-circle::before { content: ""; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 3px solid transparent; border-top-color: #cfd8dc; border-radius: 50%; animation: spin-reverse 2.5s linear infinite; opacity: 0.7; }
        .loader-inner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background-color: #3498db; border-radius: 50%; box-shadow: 0 0 15px rgba(52, 152, 219, 0.4); animation: pulse 2s ease-in-out infinite; }
        .loading-text { color: #546e7a; font-size: 1.1rem; letter-spacing: 3px; font-weight: 400; text-indent: 3px; }
        .loading-text span { display: inline-block; animation: bounce 1.5s infinite ease-in-out both; }
        .loading-text span:nth-child(1) { animation-delay: -0.32s; }
        .loading-text span:nth-child(2) { animation-delay: -0.16s; }
        .loading-text span:nth-child(3) { animation-delay: 0s; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes spin-reverse { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
        @keyframes pulse { 0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.8; box-shadow: 0 0 10px rgba(52, 152, 219, 0.2); } 50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; box-shadow: 0 0 20px rgba(52, 152, 219, 0.5); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.3;} 40% { transform: scale(1.0); opacity: 1;} }
        .bg-subtle { position: absolute; width: 400px; height: 400px; background: radial-gradient(circle, rgba(52, 152, 219, 0.04) 0%, transparent 70%); z-index: 1; }
    </style>
    <div class="bg-subtle"></div>
    <div class="container">
        <div class="loader">
            <div class="loader-circle"></div>
            <div class="loader-inner"></div>
        </div>
        <div class="loading-text">
            启动中<span>.</span><span>.</span><span>.</span>
        </div>
    </div>
</div>`);
    await writeFile(`dist/index.html`, data, 'utf-8');

}
// 输出 manifest.json 文件
async function writeManifest() {
    await ensureDir(`dist`); // 确保 dist 目录存在
    const manifest = await getManifest()
    await fsExtra.writeJSON(`dist/manifest.json`, manifest, { spaces: 2 })
}

writeManifest()


// 输出 文件夹
async function Out() {
    await fsExtra.copy(`src/assets/icons`, `dist/assets/icons`);
    
    // Copy Sandbox
    await ensureDir(`dist/src/sandbox`);
    let sandboxHtml = await readFile(`src/sandbox/index.html`, 'utf-8');
    sandboxHtml = sandboxHtml.replace('.ts', '.js');
    await writeFile(`dist/src/sandbox/index.html`, sandboxHtml, 'utf-8');

    let siteDetectorSandboxHtml = await readFile(`src/sandbox/site-detector.html`, 'utf-8');
    siteDetectorSandboxHtml = siteDetectorSandboxHtml.replace('.ts', '.js');
    await writeFile(`dist/src/sandbox/site-detector.html`, siteDetectorSandboxHtml, 'utf-8');

    // Copy Offscreen
    await ensureDir(`dist/src/offscreen`);
    let offscreenHtml = await readFile(`src/offscreen/offscreen.html`, 'utf-8');
    offscreenHtml = offscreenHtml.replace('.ts', '.js');
    await writeFile(`dist/src/offscreen/offscreen.html`, offscreenHtml, 'utf-8');
}

// 如果是开发环境
console.log(`当前环境：${isDev ? '开发' + isDev : '生产' + isDev}`);

if (isDev) {
    indexOut();
}
Out()
// chokidar.watch([r('src/manifest.ts'), r('package.json')])
//     .on('change', () => {
//         writeManifest()
//     })
