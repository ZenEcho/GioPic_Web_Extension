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
            const preferredType = config[window.location.hostname];

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
            const preferredType = config[window.location.hostname];

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
    true // Use Provider for Message/Dialog
)
