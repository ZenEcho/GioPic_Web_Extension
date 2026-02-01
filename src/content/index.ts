import { mountComponent } from './utils/mount'
import ContentOverlay from './components/ContentOverlay.vue'
import browser from 'webextension-polyfill'
import 'virtual:uno.css'
import './style.css'

function injectPageBundle() {
    const doc = document
    const root = doc.documentElement
    if (!root) return
    if (root.hasAttribute('data-giopic-page-bundle')) return // 已注入则不重复
    root.setAttribute('data-giopic-page-bundle', 'true') // 标记页面已注入

    // 同步 hover preview 设置
    browser.storage.local.get(['giopic-hover-preview', 'preview_disabled_sites']).then(res => {
        const globalEnabled = res['giopic-hover-preview'] !== false;
        const disabledSites = (res['preview_disabled_sites'] || []) as string[];
        
        const currentUrl = window.location.href;
        const currentHostname = window.location.hostname;
        const isSiteDisabled = disabledSites.some(site => {
            const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
            const siteNorm = normalize(site);
            const currentNorm = normalize(currentUrl);
            const hostnameNorm = currentHostname.toLowerCase();

            if (siteNorm === hostnameNorm) return true;

            if (site.includes('://') || site.includes('/')) {
                if (site.includes('://')) {
                    return currentNorm.startsWith(siteNorm);
                }
                const currentNoProto = currentNorm.replace(/^https?:\/\//, '');
                return currentNoProto.startsWith(siteNorm);
            }
            return false;
        });
        
        root.setAttribute('data-giopic-hover-preview', String(globalEnabled && !isSiteDisabled));
    });

    // 监听 storage 变化
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            let shouldUpdate = false;
            if (changes['giopic-hover-preview']) shouldUpdate = true;
            if (changes['preview_disabled_sites']) shouldUpdate = true;

            if (shouldUpdate) {
                // 重新获取最新状态以确保一致性
                browser.storage.local.get(['giopic-hover-preview', 'preview_disabled_sites']).then(res => {
                    const globalEnabled = res['giopic-hover-preview'] !== false;
                    const disabledSites = (res['preview_disabled_sites'] || []) as string[];
                    
                    const currentUrl = window.location.href;
                    const currentHostname = window.location.hostname;
                    const isSiteDisabled = disabledSites.some(site => {
                        const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
                        const siteNorm = normalize(site);
                        const currentNorm = normalize(currentUrl);
                        const hostnameNorm = currentHostname.toLowerCase();

                        if (siteNorm === hostnameNorm) return true;

                        if (site.includes('://') || site.includes('/')) {
                            if (site.includes('://')) {
                                return currentNorm.startsWith(siteNorm);
                            }
                            const currentNoProto = currentNorm.replace(/^https?:\/\//, '');
                            return currentNoProto.startsWith(siteNorm);
                        }
                        return false;
                    });

                    root.setAttribute('data-giopic-hover-preview', String(globalEnabled && !isSiteDisabled));
                });
            }
        }
    });

    const headOrRoot = doc.head || root

    const styleHref = browser.runtime.getURL('content/page.css')
    const link = doc.createElement('link')
    link.rel = 'stylesheet'
    link.href = styleHref
    link.setAttribute('data-giopic-page-style', 'true')
    headOrRoot.appendChild(link)

    const scriptSrc = browser.runtime.getURL('content/page.js')
    const script = doc.createElement('script')
    script.type = 'text/javascript'
    script.src = scriptSrc
    script.setAttribute('data-giopic-page-script', 'true')
    headOrRoot.appendChild(script)
}

// 监听来自后台的消息
browser.runtime.onMessage.addListener(async (message: any) => {
    if (message.type === 'UPLOAD_EVENT' && message.data?.event === 'success') {
        const { url } = message.data.payload
        const { isOrigin } = message.data
        if (!url) return

        // 检查是否开启自动注入，且当前是触发上传的源标签页
        const storage = await browser.storage.local.get(['giopic-auto-inject', 'siteEditorConfig'])
        if (storage['giopic-auto-inject'] !== false && isOrigin) {
            const config = (storage.siteEditorConfig || {}) as Record<string, string>;
            let preferredType = config[window.location.hostname];

            // Support URL-level config (Higher priority)
            const currentUrl = window.location.href;
            const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
            const currentNorm = normalize(currentUrl);
            const currentNoProto = currentNorm.replace(/^https?:\/\//, '');

            const urlMatch = Object.keys(config).find(key => {
                if (!key.includes('://') && !key.includes('/')) return false;
                const keyNorm = normalize(key);
                if (key.includes('://')) return currentNorm.startsWith(keyNorm);
                return currentNoProto.startsWith(keyNorm);
            });
            if (urlMatch) preferredType = config[urlMatch];

            // 通过 postMessage 发送给页面脚本 (Main World)
            window.postMessage({
                type: 'GIOPIC_INJECT',
                url: url,
                preferredType
            }, '*')
        }
    } else if (message.type === 'MANUAL_INJECT') {
        const { url } = message.payload
        if (url) {
            const storage = await browser.storage.local.get('siteEditorConfig');
            const config = (storage.siteEditorConfig || {}) as Record<string, string>;
            let preferredType = config[window.location.hostname];

            // Support URL-level config (Higher priority)
            const currentUrl = window.location.href;
            const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
            const currentNorm = normalize(currentUrl);
            const currentNoProto = currentNorm.replace(/^https?:\/\//, '');

            const urlMatch = Object.keys(config).find(key => {
                if (!key.includes('://') && !key.includes('/')) return false;
                const keyNorm = normalize(key);
                if (key.includes('://')) return currentNorm.startsWith(keyNorm);
                return currentNoProto.startsWith(keyNorm);
            });
            if (urlMatch) preferredType = config[urlMatch];

             window.postMessage({
                type: 'GIOPIC_INJECT',
                url: url,
                preferredType
            }, '*')
        }
    }
})

// 监听来自页面脚本的消息 (用于更新编辑器绑定)
window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'GIOPIC_EDITOR_SUCCESS') {
        const { hostname, editorType } = event.data;
        if (hostname && editorType) {
            const res = await browser.storage.local.get('siteEditorConfig');
            const config = (res.siteEditorConfig || {}) as Record<string, string>;
            
            // 如果配置发生变化，则更新存储
            if (config[hostname] !== editorType) {
                config[hostname] = editorType;
                await browser.storage.local.set({ siteEditorConfig: config });
            }
        }
    }
});

console.log('GioPic content script loaded')

injectPageBundle()

try {
    browser.runtime.sendMessage({ type: 'REGISTER_CONTENT' })
} catch {}

// 挂载单一容器
mountComponent(
    ContentOverlay,
    'giopic-content-overlay',
    true,
    {},
    true 
)
