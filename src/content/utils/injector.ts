/**
 * @file injector.ts
 * @description 注入消息广播工具
 * 
 * 职责：
 * 1. 提供跨窗口/跨 Frame 的图片注入消息广播功能
 * 2. 处理跨域 iframe 通信问题
 * 3. 智能推断当前页面的编辑器类型偏好
 * 
 * 依赖：
 * - webextension-polyfill: 读取存储配置
 */

import browser from 'webextension-polyfill';

/**
 * 广播图片注入消息
 * 支持：
 * 1. 当前窗口注入
 * 2. 如果是顶层窗口，向所有 iframe 广播（解决 iframe 编辑器跨域问题）
 * 3. 自动根据 Hostname 或 URL 匹配用户配置的首选编辑器类型
 * 
 * @param url - 图片地址
 * @param preferredType - 首选编辑器类型（可选），若不传则自动从配置中查找
 */
export async function broadcastInjectMessage(url: string, preferredType?: string) {
    if (!url) return;

    // 如果没有提供 preferredType，尝试从存储中获取
    if (!preferredType) {
        try {
            const storage = await browser.storage.local.get('siteEditorConfig');
            const config = (storage.siteEditorConfig || {}) as Record<string, string>;
            preferredType = config[window.location.hostname];

            // 支持 URL 级别的配置（更高优先级）
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
        } catch (e) {
            // 忽略存储读取错误
        }
    }

    const message = {
        type: 'GIOPIC_INJECT',
        url: url,
        preferredType
    };

    // 1. 发送给自己 (当前窗口)
    window.postMessage(message, '*');

    // 2. 如果是 Top Frame，广播给所有 iframe (解决跨域 iframe 问题)
    if (window === window.top) {
        const iframes = document.querySelectorAll('iframe');
        if (iframes.length > 0) {
            console.log(`[GioPic] Broadcasting inject message to ${iframes.length} iframes`);
            iframes.forEach(iframe => {
                try {
                    iframe.contentWindow?.postMessage(message, '*');
                } catch (e) {
                    // Ignore cross-origin access errors
                }
            });
        }
    }
}
