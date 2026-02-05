/**
 * @file types.ts
 * @description 编辑器注入模块的类型定义
 * 
 * 职责：
 * 1. 定义检测结果、注入结果、适配器接口
 * 2. 定义各种全局编辑器对象的类型签名 (TypeScript 补全)
 */

import type { EditorType } from './meta';

export type { EditorType };

/**
 * 编辑器检测结果
 */
export interface DetectionResult {
    type: EditorType;   // 编辑器类型
    certainty: number;  // 置信度 (0-1)
    source: string;     // 检测来源 (例如 'global: tinymce', 'selector: .CodeMirror')
}

/**
 * 可执行注入的检测结果
 */
export interface InjectableDetectionResult extends DetectionResult {
    inject: (url: string) => Promise<boolean> | boolean;
}

/**
 * 编辑器适配器接口
 * 每个适配器负责一种编辑器的检测和注入逻辑
 */
export interface EditorAdapter {
    id: EditorType;
    detect: () => DetectionResult | null;
    inject: (url: string) => boolean | Promise<boolean>;
}

// Global Window Interfaces
export interface PhpBBType {
    [key: string]: any;
}

export interface TinyMCEType {
    activeEditor?: {
        execCommand: (command: string, ui: boolean, value: string) => void;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface WangEditorType {
    getEditableContainer: () => HTMLElement | null;
    dangerouslyInsertHtml: (html: string) => void;
    [key: string]: any;
}

export interface CKEditor4Type {
    instances?: {
        [key: string]: {
            insertHtml: (html: string) => void;
            [key: string]: any;
        };
    };
    [key: string]: any;
}

export interface CKEditor5Type {
    ui?: {
        view?: any;
    };
    getData: () => string;
    setData: (data: string) => void;
    [key: string]: any;
}

export interface UEType {
    getEditor: (id: string) => {
        execCommand: (command: string, options?: any) => void;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface WPElementType {
    data: {
        dispatch: (store: string) => {
            insertBlock: (block: any) => void;
            [key: string]: any;
        };
    };
    blocks: {
        createBlock: (name: string, attributes?: any) => any;
    };
    [key: string]: any;
}

export interface CodeMirrorElementType extends HTMLElement {
    CodeMirror?: {
        getValue: () => string;
        setValue: (value: string) => void;
    };
}

declare global {
    interface Window {
        phpbb?: PhpBBType;
        tinymce?: TinyMCEType;
        editor?: WangEditorType | CKEditor5Type; // Ambiguous name 'editor'
        CKEDITOR?: CKEditor4Type;
        UE?: UEType;
        wp?: WPElementType;
    }
}
