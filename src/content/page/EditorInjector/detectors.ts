import type{
    DetectionResult,
    EditorType,
    PhpBBType,
    TinyMCEType,
    WangEditorType,
    CKEditor4Type,
    CKEditor5Type,
    UEType
} from '../EditorInjector/types';

// 域名检测器
const domainDetectors: Record<string, EditorType> = {
    'nodeseek.com': 'nodeseek',
    'v2ex.com': 'V2EX',
    'lowendtalk.com': 'lowendtalk',
};

// CMS 框架检测器
const cmsDetectors: Array<() => DetectionResult | null> = [
    () => {
        const bodyInnerText = document.body.innerText;
        const Discuz = bodyInnerText.toLowerCase().includes("discuz") || bodyInnerText.toLowerCase().includes("论坛") == true;
        return Discuz ? {
            type: 'Discuz',
            certainty: 0.8,
            source: 'TextIncludes'
        } : null;
    },
    () => {
        const bodyInnerText = document.body.innerText;
        const typecho = bodyInnerText.toLowerCase().includes("typecho");
        const Typecho = document.getElementById("btn-submit");
        return typecho && Typecho ? {
            type: 'Typecho',
            certainty: 0.9,
            source: 'TextIncludes and getElementById'
        } : null;
    },
    () => {
        const HaloEditorElement = document.getElementsByClassName("halo-rich-text-editor");
        return HaloEditorElement.length ? {
            type: 'Halo',
            certainty: 0.8,
            source: 'getElementsByClassName'
        } : null;

    },
    () => {
        const phpBB = window.phpbb;
        const phpBBID = document.getElementById("phpbb");
        return phpBB && phpBBID ? {
            type: 'phpBB',
            certainty: 1,
            source: 'global variable and getElementById'
        } : null;
    },
];

// 编辑器检测器
const editorDetectors: Array<() => DetectionResult | null> = [
    () => {
        const CodeMirrorEditor = document.querySelector(".CodeMirror");
        return CodeMirrorEditor ? {
            type: 'CodeMirror5',
            certainty: 0.9,
            source: 'querySelector'
        } : null;
    },
    () => {
        const CodeMirrorEditor = document.querySelector(".cm-editor");
        return CodeMirrorEditor ? {
            type: 'CodeMirror6',
            certainty: 0.9,
            source: 'querySelector'
        } : null;
    },
    () => {
        const Gutenberg = document.getElementById("wpbody-content");
        const wpfooter = document.getElementsByClassName("interface-interface-skeleton__footer");
        return Gutenberg && wpfooter.length ? {
            type: 'GutenbergEditor',
            certainty: 0.9,
            source: 'getElementById and getElementsByClassName'
        } : null;
    },
    () => {
        try {
            const TinyMCE = window.tinymce?.activeEditor;
            return TinyMCE ? {
                type: 'TinyMCE',
                certainty: 1,
                source: 'global variable'
            } : null;
        } catch (error) {
            return null;
        }
    },
    () => {
        try {
            const globalEditor = window.editor as WangEditorType | undefined;
            // Need to distinguish between wangEditor and CKEditor5 as both might use 'editor' global
            const isWangEditor = globalEditor && typeof globalEditor.getEditableContainer === 'function';
            const wangeditor = isWangEditor ? globalEditor.getEditableContainer() : null;
            return wangeditor ? {
                type: 'wangEditor',
                certainty: 1,
                source: 'global variable'
            } : null;
        } catch (error) {
            return null;
        }

    },
    () => {
        try {
            const ckeditor4 = window.CKEDITOR;
            const ckeditor_Elements = ckeditor4?.instances?.ckdemoarticle;
            return ckeditor_Elements ? {
                type: 'CKEditor4',
                certainty: 1,
                source: 'global variable'
            } : null;
        } catch (error) {
            return null;
        }

    },
    () => {
        try {
            const isCKEditor5 = !!document.querySelector('.ck.ck-content');
            const editor = window.editor as CKEditor5Type | undefined;
            const ckeditor5 = editor?.ui?.view;
            return ckeditor5 && isCKEditor5 ? {
                type: 'CKEditor5',
                certainty: 1,
                source: 'global variable'
            } : null;
        } catch (error) {
            return null;
        }
    },
    () => {
        try {
            const UE = window.UE;
            // 检查 UE 是否存在并且有 getEditor 方法
            const hasUEditor = UE && typeof UE.getEditor === 'function';
            return hasUEditor ? {
                type: 'UEditor',
                certainty: 1,
                source: 'global variable'
            } : null;
        } catch (error) {
            return null;
        }
    },

];

export class Detector {
    static detect(): DetectionResult[] {
        // 收集所有检测结果而不是只返回第一个
        const results: DetectionResult[] = [];

        // 添加域名检测结果
        const domainResults = this.detectByDomain();
        if (domainResults) results.push(domainResults);

        // 添加CMS检测结果
        const cmsResults = this.detectByCMS();
        if (cmsResults) results.push(...cmsResults);

        // 添加编辑器检测结果
        const editorResults = this.detectByEditor();
        if (editorResults) results.push(...editorResults);

        // 如果没有任何检测结果，返回unknown
        if (results.length === 0) {
            return [{ type: 'unknown', certainty: 0, source: 'none' }];
        }

        // 按certainty值从高到低排序
        results.sort((a, b) => b.certainty - a.certainty);

        return results;
    }
    // 在页面完全加载后执行检测
    static detectWhenReady(options: {
        stabilityDelay?: number;  // DOM稳定的时间（毫秒）
        maxWaitTime?: number;     // 最大等待时间（毫秒）
        callback: (results: DetectionResult[]) => void;
    }): void {
        const {
            stabilityDelay = 1000, // 默认延迟1.5秒
            maxWaitTime = 8000, // 默认最大等待时间8秒
            callback
        } = options;

        // 确保页面已经加载
        if (document.readyState === 'complete') {
            this.observeDOMStability(stabilityDelay, maxWaitTime, callback);
        } else {
            window.addEventListener('load', () => {
                this.observeDOMStability(stabilityDelay, maxWaitTime, callback);
            });
        }
    }
    // 观察DOM变化，当DOM稳定后执行检测
    private static observeDOMStability(
        stabilityDelay: number,
        maxWaitTime: number,
        callback: (results: DetectionResult[]) => void
    ): void {
        let domStabilityTimer: number | null = null;
        let maxWaitTimer: number | null = null;
        let hasExecuted = false;

        // 执行检测并清理资源
        const executeDetection = () => {
            hasExecuted = true;
            observer.disconnect();

            if (maxWaitTimer !== null) {
                window.clearTimeout(maxWaitTimer);
            }

            const results = this.detect();
            callback(results);
        };

        // 创建MutationObserver监视DOM变化
        const observer = new MutationObserver(() => {
            // 如果有定时器，重置它
            if (domStabilityTimer !== null) {
                window.clearTimeout(domStabilityTimer);
            }

            // 设置新的定时器
            domStabilityTimer = window.setTimeout(() => {
                if (!hasExecuted) {
                    executeDetection();
                }
            }, stabilityDelay);
        });

        // 设置最大等待时间
        maxWaitTimer = window.setTimeout(() => {
            if (!hasExecuted) {
                executeDetection();
            }
        }, maxWaitTime);

        // 开始观察DOM变化
        observer.observe(document.body, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });

        // 如果DOM已经稳定，设置初始延迟检测
        domStabilityTimer = window.setTimeout(() => {
            if (!hasExecuted) {
                executeDetection();
            }
        }, stabilityDelay);
    }
    private static detectByDomain(): DetectionResult | null {
        const domain = window.location.hostname;
        for (const [key, type] of Object.entries(domainDetectors)) {
            if (domain.endsWith(key)) {
                return {
                    type,
                    certainty: 1.0,
                    source: 'domain'
                };
            }
        }
        return null;
    }

    private static detectByCMS(): DetectionResult[] | null {
        const results: DetectionResult[] = [];
        for (const detector of cmsDetectors) {
            const result = detector();
            if (result) results.push(result);
        }
        return results.length > 0 ? results : null;
    }

    private static detectByEditor(): DetectionResult[] | null {
        const results: DetectionResult[] = [];
        for (const detector of editorDetectors) {
            const result = detector();
            if (result) results.push(result);
        }
        return results.length > 0 ? results : null;
    }
}
