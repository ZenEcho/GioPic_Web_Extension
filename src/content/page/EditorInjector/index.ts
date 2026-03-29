/**
 * @file index.ts
 * @description 编辑器检测与注入核心逻辑
 * 
 * 职责：
 * 1. 协调各个编辑器适配器进行检测
 * 2. 监听来自 Content Script 的图片注入消息
 * 3. 执行具体的图片注入逻辑
 * 4. 提供编辑器加载完成的检测机制 (detectWhenReady)
 */

import { editorAdapterRegistry } from './pluginRuntime';
import type { InjectableDetectionResult, EditorType } from './types';

export class Detector {
    /**
     * 检测当前页面存在的编辑器
     * 遍历所有适配器，返回检测到的结果列表
     */
    static detect(): InjectableDetectionResult[] {
        const results: InjectableDetectionResult[] = [];

        for (const adapter of editorAdapterRegistry.getAdapters()) {
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

    /**
     * 等待编辑器加载完成并进行检测
     * 
     * 现代前端框架通常延迟渲染，因此需要观察 DOM 变化并等待稳定后再检测。
     * 
     * @param options 配置选项
     * @param options.stabilityDelay DOM 稳定时间 (毫秒)，即多久没有 DOM 变化才认为稳定
     * @param options.maxWaitTime 最大等待时间 (毫秒)，超时后强制返回当前结果
     * @param options.callback 检测完成后的回调函数
     */
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

            // 如果检测到的编辑器数量发生变化，重置稳定计时器
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

        // 初始检测
        check();

        // 监听 DOM 变化 (subtree: true 表示监听所有后代节点)
        const observer = new MutationObserver(check);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 最大等待时间兜底
        maxWaitTimer = setTimeout(() => {
            cleanup();
            callback(this.detect());
        }, maxWaitTime);
    }

    /**
     * 自动检测并注入图片 URL
     * 会选择置信度最高的结果进行注入
     * @param url 图片地址
     * @param preferredType 首选编辑器类型 (如果指定，将优先尝试该编辑器)
     * @returns 是否注入成功
     */
    static async inject(url: string, preferredType?: EditorType): Promise<boolean> {
        // 1. 如果指定了首选编辑器，优先尝试
        if (preferredType) {
            const adapter = editorAdapterRegistry.getAdapters().find(a => a.id === preferredType);
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

        // 2. 自动检测并选择置信度最高的编辑器
        const results = this.detect();
        if (results.length === 0) {
            return false;
        }

        // 按置信度降序排序
        results.sort((a, b) => b.certainty - a.certainty);
        const bestMatch = results[0];

        if (bestMatch) {
            const success = await bestMatch.inject(url);
            if (success) {
                // 发送成功消息，Content Script 可能会据此自动绑定默认编辑器
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
     * @param url 测试图片地址
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
     * 
     * 机制：
     * Content Script 无法直接访问 Page Context 的编辑器对象 (window.editor)，
     * 必须通过 window.postMessage 发送消息给 Page Script (本脚本)，
     * 由本脚本在 Page Context 中执行注入。
     */
    static startListening(): void {
        window.addEventListener('message', async (event) => {
            // 安全检查：只接受来自当前窗口 或 父窗口/顶层窗口 的消息
            const isSafeSource = event.source === window || 
                               event.source === window.parent || 
                               event.source === window.top;
            
            if (!isSafeSource) return;

            if (event.data?.type === 'GIOPIC_SYNC_EDITOR_PLUGINS' && Array.isArray(event.data?.plugins)) {
                editorAdapterRegistry.syncPlugins(event.data.plugins);
                console.log('[Detector] Editor adapter plugins synced:', event.data.plugins.length);
                return;
            }

            if (event.data?.type === 'GIOPIC_INJECT' && event.data?.url) {
                console.log('[Detector] 收到注入请求:', {
                    url: event.data.url, // 图片 URL
                    preferredType: event.data.preferredType, // 首选编辑器类型
                    source: event.source === window ? 'Self' : 'Parent/Top', // 来源
                    href: window.location.href // 当前页面 URL
                });
                await this.inject(event.data.url, event.data.preferredType);
            }
        });

        window.postMessage({
            type: 'GIOPIC_PAGE_READY',
            href: window.location.href
        }, '*');
    }
}

export * from './types';
export * from './meta';
