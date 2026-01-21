import { Detector as RawDetector } from '../EditorInjector/detectors';
import type { DetectionResult, InjectableDetectionResult, EditorType } from '../EditorInjector/types';
import * as Handlers from '../EditorInjector/handlers';

const handlerMap: Record<EditorType, (url: string) => boolean | Promise<boolean>> = {
    'Discuz': Handlers.handleDiscuz,
    'Halo': Handlers.handleHalo,
    'Typecho': Handlers.handleTypecho,
    'phpBB': Handlers.handlePHPBB,
    'V2EX': Handlers.handleV2ex,
    'nodeseek': Handlers.handleCodeMirror5,
    'lowendtalk': Handlers.handleLowEndTalk,
    'CodeMirror5': Handlers.handleCodeMirror5,
    'CodeMirror6': Handlers.handleCodeMirror6,
    'GutenbergEditor': Handlers.handleGutenberg,
    'TinyMCE': Handlers.handleTinyMCE,
    'wangEditor': Handlers.handleWangEditor,
    'CKEditor4': Handlers.handleCKEditor4,
    'CKEditor5': Handlers.handleCKEditor5,
    'UEditor': Handlers.handleUEditor,
    'unknown': () => false
};

function enrichResult(result: DetectionResult): InjectableDetectionResult {
    return {
        ...result,
        inject: (url: string) => {
            const handler = handlerMap[result.type];
            if (handler) {
                return handler(url);
            }
            return false;
        }
    };
}

export class Detector {
    static detect(): InjectableDetectionResult[] {
        const results = RawDetector.detect();
        return results.map(enrichResult);
    }

    static detectWhenReady(options: {
        stabilityDelay?: number;
        maxWaitTime?: number;
        callback: (results: InjectableDetectionResult[]) => void;
    }): void {
        RawDetector.detectWhenReady({
            ...options,
            callback: (results) => {
                const enriched = results.map(enrichResult);
                options.callback(enriched);
            }
        });
    }

    /**
     * 自动检测并注入图片 URL
     * 会选择置信度最高的结果进行注入
     * @param url 图片地址
     * @returns 是否注入成功
     */
    static async inject(url: string): Promise<boolean> {
        const results = this.detect();
        if (results.length === 0) {
            return false;
        }

        // 按置信度排序，取最高的一个
        results.sort((a, b) => b.certainty - a.certainty);
        const bestMatch = results[0];
        
        return bestMatch?.inject(url) ?? false;
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
            // 只接受来自当前窗口的消息
            if (event.source !== window) return;

            if (event.data?.type === 'GIOPIC_INJECT' && event.data?.url) {
                console.log('[Detector] 收到注入请求:', event.data.url);
                await this.inject(event.data.url);
            }
        });
    }
}

export * from '../EditorInjector/types';

