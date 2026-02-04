
import { adapters } from './adapters';
import type { InjectableDetectionResult, EditorType } from './types';

export class Detector {
    static detect(): InjectableDetectionResult[] {
        const results: InjectableDetectionResult[] = [];

        for (const adapter of adapters) {
            try {
                const result = adapter.detect();
                if (result) {
                    results.push({
                        ...result,
                        inject: adapter.inject
                    });
                }
            } catch (e) {
                console.warn(`[GioPic] Adapter ${adapter.id} detection failed:`, e);
            }
        }
        return results;
    }

    static detectWhenReady(options: {
        stabilityDelay?: number;
        maxWaitTime?: number;
        callback: (results: InjectableDetectionResult[]) => void;
    }): void {
        const { stabilityDelay = 1000, maxWaitTime = 5000, callback } = options;
        let lastResultCount = 0;
        let stabilityTimer: any = null;
        let maxWaitTimer: any = null;

        const check = () => {
            const results = this.detect();

            // If results changed, reset stability timer
            if (results.length !== lastResultCount) {
                lastResultCount = results.length;
                if (stabilityTimer) clearTimeout(stabilityTimer);

                stabilityTimer = setTimeout(() => {
                    cleanup();
                    callback(results);
                }, stabilityDelay);
            }
        };

        const cleanup = () => {
            if (maxWaitTimer) clearTimeout(maxWaitTimer);
            if (stabilityTimer) clearTimeout(stabilityTimer);
            observer.disconnect();
        };

        // Initial check
        check();

        // Observe DOM changes
        const observer = new MutationObserver(check);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Max wait time fallback
        maxWaitTimer = setTimeout(() => {
            cleanup();
            callback(this.detect());
        }, maxWaitTime);
    }

    /**
     * 自动检测并注入图片 URL
     * 会选择置信度最高的结果进行注入
     * @param url 图片地址
     * @param preferredType 首选编辑器类型
     * @returns 是否注入成功
     */
    static async inject(url: string, preferredType?: EditorType): Promise<boolean> {
        // Direct injection via preferred type if provided
        if (preferredType) {
            const adapter = adapters.find(a => a.id === preferredType);
            if (adapter) {
                console.log(`[Detector] Using preferred adapter: ${preferredType}`);
                try {
                    const success = await adapter.inject(url);
                    if (success) return true;
                } catch (e) {
                    console.warn(`[Detector] Preferred adapter ${preferredType} failed:`, e);
                }
            }
        }

        // Auto-detection fallback
        const results = this.detect();
        if (results.length === 0) {
            return false;
        }

        // Sort by certainty
        results.sort((a, b) => b.certainty - a.certainty);
        const bestMatch = results[0];

        if (bestMatch) {
            const success = await bestMatch.inject(url);
            if (success) {
                // 发送成功消息，用于自动绑定
                window.postMessage({
                    type: 'GIOPIC_EDITOR_SUCCESS',
                    hostname: window.location.hostname,
                    editorType: bestMatch.type
                }, '*');
            }
            return success;
        }
        return false;
    }

    /**
     * 测试注入功能 (用于开发调试)
     * 自动检测当前页面编辑器并尝试注入测试图片
     */
    static async testInjection(url: string = 'https://example.com/test-image.png'): Promise<boolean> {
        console.log('[Detector] 开始测试注入...');
        const success = await this.inject(url);
        if (success) {
            console.log('[Detector] 注入成功');
        } else {
            console.warn('[Detector] 注入失败或未检测到支持的编辑器');
        }
        return success;
    }

    /**
     * 启动消息监听，处理来自 Content Script 的注入请求
     */
    static startListening(): void {
        window.addEventListener('message', async (event) => {
            // 接受来自当前窗口 或 父窗口/顶层窗口 的消息 (解决 iframe 跨域通讯问题)
            const isSafeSource = event.source === window || 
                               event.source === window.parent || 
                               event.source === window.top;
            
            if (!isSafeSource) return;

            if (event.data?.type === 'GIOPIC_INJECT' && event.data?.url) {
                console.log('[Detector] 收到注入请求:', {
                    url: event.data.url, // 图片 URL
                    preferredType: event.data.preferredType, // 首选编辑器类型
                    source: event.source === window ? 'Self' : 'Parent/Top', // 来源：当前窗口或父窗口/顶层窗口
                    href: window.location.href // 当前页面 URL
                });
                await this.inject(event.data.url, event.data.preferredType);
            }
        });
    }
}

export * from './types';
export * from './meta';
