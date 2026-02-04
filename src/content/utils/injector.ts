import browser from 'webextension-polyfill';

/**
 * 广播图片注入消息
 * 支持：
 * 1. 当前窗口注入
 * 2. 如果是顶层窗口，向所有 iframe 广播
 * 
 * @param url 图片地址
 * @param preferredType 首选编辑器类型（可选）
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
