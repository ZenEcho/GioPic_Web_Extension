/**
 * @file index.ts
 * @description Content Script 入口文件
 * 
 * 职责：
 * 1. 初始化 Content Script 环境，注入页面级脚本和样式
 * 2. 监听 Background 消息，处理图片上传成功通知、手动注入请求等
 * 3. 监听页面消息，处理编辑器状态更新、插件安装/管理请求
 * 4. 挂载 Content Overlay 组件
 * 
 * 依赖：
 * - webextension-polyfill: 浏览器扩展 API
 * - ./utils/mount: Vue 组件挂载工具
 * - ./components/ContentOverlay.vue: 注入页面的主要 UI 组件
 */

import { mountComponent } from './utils/mount'
import ContentOverlay from './components/ContentOverlay.vue'
import browser from 'webextension-polyfill'
import { broadcastInjectMessage } from './utils/injector'
import { PLUGIN_MARKET_PERMISSION_DENIED_ERROR } from '@/constants/pluginMarketAccess'
import type { PluginMeta } from '@/types'
import {
    getPluginMarketAllowAllSites,
    getPluginMarketAuthorizedSites,
    hasPluginMarketFullAccess,
    toPluginPublicSummaries,
} from '@/utils/pluginMarketAccess'
import pkg from '../../package.json'
import 'virtual:uno.css'
import './style.css'

/**
 * 注入页面级资源包（JS/CSS）
 * 将扩展内的 page.js 和 page.css 注入到当前页面 DOM 中，
 * 以便在页面上下文中执行代码（如访问页面全局变量）。
 * 同时处理 hover preview 的全局开关和站点黑名单逻辑。
 */
function injectPageBundle() {
    const doc = document
    const root = doc.documentElement
    if (!root) return
    if (root.hasAttribute('data-giopic-page-bundle')) return // 已注入则不重复
    root.setAttribute('data-giopic-page-bundle', 'true') // 标记页面已注入

    // 同步 hover preview 设置
    browser.storage.local.get(['giopic-hover-preview', 'preview_disabled_sites']).then(res => {
        const globalEnabled = res['giopic-hover-preview'] !== false;
        const rawDisabled = res['preview_disabled_sites'];
        const disabledSites = (Array.isArray(rawDisabled) ? rawDisabled : []) as string[];

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
                    const rawDisabled = res['preview_disabled_sites'];
                    const disabledSites = (Array.isArray(rawDisabled) ? rawDisabled : []) as string[];

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

/**
 * 向页面注入图片
 * 将图片 URL 广播给页面脚本，由页面脚本根据当前编辑器类型进行插入。
 * 
 * @param url - 图片 URL
 */
async function injectImageToPage(url: string) {
    // 使用统一的注入广播工具
    await broadcastInjectMessage(url);

}

function getPageMessageOrigin(event: MessageEvent) {
    if (typeof event.origin === 'string' && event.origin) {
        return event.origin
    }

    return window.location.origin
}

function getPageMessageTargetOrigin(origin: string) {
    return origin && origin !== 'null' ? origin : '*'
}

function postPageMessage(type: string, payload: Record<string, any>, targetOrigin: string) {
    window.postMessage({
        type,
        ...payload,
    }, targetOrigin)
}

async function getPluginBridgeAccess(event: MessageEvent) {
    const origin = getPageMessageOrigin(event)
    const [authorizedSites, allowAllSites] = await Promise.all([
        getPluginMarketAuthorizedSites(),
        getPluginMarketAllowAllSites(),
    ])

    return {
        origin,
        targetOrigin: getPageMessageTargetOrigin(origin),
        hasFullAccess: hasPluginMarketFullAccess(origin, authorizedSites, allowAllSites),
    }
}

// 监听来自后台的消息
browser.runtime.onMessage.addListener(async (message: any) => {
    if (message.type === 'UPLOAD_EVENT' && message.data?.event === 'success') {
        const { url } = message.data.payload
        if (!url) return

        // 检查是否开启自动注入
        // Background 脚本会确保消息只发送给正确的 Tab
        const storage = await browser.storage.local.get(['giopic-auto-inject'])
        if (storage['giopic-auto-inject'] !== false) {
            await injectImageToPage(url)
        }
    } else if (message.type === 'MANUAL_INJECT') {
        const { url } = message.payload
        if (url) {
            await injectImageToPage(url)
        }
    } else if (message.type === 'REFRESH_PLUGINS') {
        // 通知网页插件列表已更新
        window.postMessage({
            type: 'GIOPIC_PLUGINS_UPDATED'
        }, '*');
    }
})

// 监听来自页面脚本的消息 (用于更新编辑器绑定)
window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data) return;
    //监听来自网页的编辑器状态更新消息 (Editor Binding)
    if (data.type === 'GIOPIC_EDITOR_SUCCESS') {
        const { hostname, editorType } = data;
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

    // 监听来自网页的插件安装请求 (Plugin Market Integration)
    else if (data.type === 'GIOPIC_INSTALL_PLUGIN') {
        const { plugin } = data;
        const access = await getPluginBridgeAccess(event)

        if (!access.hasFullAccess) {
            postPageMessage('GIOPIC_INSTALL_PLUGIN_RESULT', {
                success: false,
                error: PLUGIN_MARKET_PERMISSION_DENIED_ERROR,
                pluginId: plugin?.id,
            }, access.targetOrigin)
            return
        }

        // 转发给 Background
        try {
            const res = (await browser.runtime.sendMessage({
                type: 'INSTALL_PLUGIN',
                plugin
            })) as { success: boolean; error?: string };

            // 返回结果给网页
            postPageMessage('GIOPIC_INSTALL_PLUGIN_RESULT', {
                success: res?.success || false,
                error: res?.error || (res ? undefined : 'No response from extension'),
                pluginId: plugin?.id
            }, access.targetOrigin);
        } catch (e: any) {
            postPageMessage('GIOPIC_INSTALL_PLUGIN_RESULT', {
                success: false,
                error: e.message || 'Extension communication error',
                pluginId: plugin?.id
            }, access.targetOrigin);
        }
    }
    // 启用/禁用插件
    else if (data.type === 'GIOPIC_TOGGLE_PLUGIN') {
        const { pluginId, enabled } = data;
        const access = await getPluginBridgeAccess(event)

        if (!access.hasFullAccess) {
            postPageMessage('GIOPIC_TOGGLE_PLUGIN_RESULT', {
                success: false,
                error: PLUGIN_MARKET_PERMISSION_DENIED_ERROR,
                pluginId,
            }, access.targetOrigin)
            return
        }

        try {
            const res = (await browser.runtime.sendMessage({
                type: 'TOGGLE_PLUGIN',
                pluginId,
                enabled
            })) as { success: boolean; error?: string };

            postPageMessage('GIOPIC_TOGGLE_PLUGIN_RESULT', {
                success: res?.success || false,
                error: res?.error || (res ? undefined : 'No response from extension'),
                pluginId
            }, access.targetOrigin);
        } catch (e: any) {
            postPageMessage('GIOPIC_TOGGLE_PLUGIN_RESULT', {
                success: false,
                error: e.message,
                pluginId
            }, access.targetOrigin);
        }
    }
    // 卸载插件
    else if (data.type === 'GIOPIC_UNINSTALL_PLUGIN') {
        const { pluginId } = data;
        const access = await getPluginBridgeAccess(event)

        if (!access.hasFullAccess) {
            postPageMessage('GIOPIC_UNINSTALL_PLUGIN_RESULT', {
                success: false,
                error: PLUGIN_MARKET_PERMISSION_DENIED_ERROR,
                pluginId,
            }, access.targetOrigin)
            return
        }

        try {
            const res = (await browser.runtime.sendMessage({
                type: 'UNINSTALL_PLUGIN',
                pluginId
            })) as { success: boolean; error?: string };

            postPageMessage('GIOPIC_UNINSTALL_PLUGIN_RESULT', {
                success: res?.success || false,
                error: res?.error || (res ? undefined : 'No response from extension'),
                pluginId
            }, access.targetOrigin);
        } catch (e: any) {
            postPageMessage('GIOPIC_UNINSTALL_PLUGIN_RESULT', {
                success: false,
                error: e.message,
                pluginId
            }, access.targetOrigin);
        }
    }
    // 获取已安装插件列表
    else if (data.type === 'GIOPIC_GET_INSTALLED_PLUGINS') {
        const access = await getPluginBridgeAccess(event)

        try {
            const res = (await browser.runtime.sendMessage({
                type: 'GET_INSTALLED_PLUGINS'
            })) as { success: boolean; plugins?: any[]; error?: string };

            const plugins = Array.isArray(res?.plugins)
                ? (access.hasFullAccess
                    ? res.plugins
                    : toPluginPublicSummaries(res.plugins as PluginMeta[]))
                : []

            postPageMessage('GIOPIC_GET_INSTALLED_PLUGINS_RESULT', {
                success: res?.success || false,
                plugins,
                error: res?.error || (res ? undefined : 'No response from extension')
            }, access.targetOrigin);
        } catch (e: any) {
            postPageMessage('GIOPIC_GET_INSTALLED_PLUGINS_RESULT', {
                success: false,
                error: e.message
            }, access.targetOrigin);
        }
    }
});

function printStyledLogs() {
    const styles = {
        title: 'color: #fff; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); font-size: 24px; font-weight: bold; padding: 8px 16px; border-radius: 8px;',
        version: 'background: #41b883; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: bold;',
        label: 'background: #35495e; color: #fff; padding: 2px 8px; border-radius: 4px 0 0 4px;',
        value: 'background: #f8f9fa; color: #333; padding: 2px 8px; border-radius: 0 4px 4px 0;',
        info: 'color: #17a2b8; font-size: 12px;',
        success: 'color: #28a745; font-size: 12px;',
    }

    console.log('\n')
    console.log('%c🚀 ' + (pkg.displayName || pkg.name), styles.title)
    console.log('%c v' + pkg.version + ' ', styles.version)
    console.log('\n')

    console.log('%c 功能 %c ' + pkg.description, styles.label, styles.value)
    console.log('%c 支持 %c Lsky / 对象存储 / S3接口 / GitHub 等 ', styles.label, styles.value)
    console.log('%c 插件 %c 支持 JavaScript 插件扩展 ', styles.label, styles.value)
    console.log('%c 官网 %c https://fileup.dev ', styles.label, styles.value)
    console.log('%c 开源 %c https://github.com/ZenEcho/GioPic_Web_Extension ', styles.label, styles.value)

    console.log('\n')
    console.log('%c✓ Content Script 已加载', styles.success)
    console.log('%c💡 提示: 右键图片可快速上传', styles.info)
    console.log('\n')
}

injectPageBundle()

// 挂载单一容器
if (window.self === window.top) {
    mountComponent(ContentOverlay, 'giopic-content-overlay', true, {}, true)
    printStyledLogs()
}
