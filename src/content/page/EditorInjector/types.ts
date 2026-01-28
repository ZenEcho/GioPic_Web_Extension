
import type { EditorType } from './meta';

export type { EditorType };

export interface DetectionResult {
    type: EditorType;
    certainty: number;
    source: string;
}

export interface InjectableDetectionResult extends DetectionResult {
    inject: (url: string) => Promise<boolean> | boolean;
}

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
