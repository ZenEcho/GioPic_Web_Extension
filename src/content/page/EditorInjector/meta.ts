/**
 * @file meta.ts
 * @description 编辑器元数据定义
 * 
 * 职责：
 * 1. 定义编辑器类型和内置编辑器元数据
 * 2. 提供编辑器显示名称映射 (EDITOR_META)
 * 3. 支持与 editor-adapter 插件元数据合并
 */

export type EditorType = string & {}

export interface EditorMeta {
    id: EditorType;
    name: string;
}

/**
 * 编辑器元数据列表
 * 用于 UI 显示和配置
 */
export const EDITOR_META: EditorMeta[] = [
    { id: 'Discuz', name: 'Discuz!' },
    { id: 'Halo', name: 'Halo' },
    { id: 'Typecho', name: 'Typecho' },
    { id: 'phpBB', name: 'phpBB' },
    { id: 'V2EX', name: 'V2EX' },
    { id: 'nodeseek', name: 'NodeSeek' },
    { id: 'lowendtalk', name: 'LowEndTalk' },
    { id: 'CodeMirror5', name: 'CodeMirror 5' },
    { id: 'CodeMirror6', name: 'CodeMirror 6' },
    { id: 'GutenbergEditor', name: 'WordPress Gutenberg' },
    { id: 'TinyMCE', name: 'TinyMCE' },
    { id: 'wangEditor', name: 'wangEditor' },
    { id: 'CKEditor4', name: 'CKEditor 4' },
    { id: 'CKEditor5', name: 'CKEditor 5' },
    { id: 'UEditor', name: 'UEditor' },
    { id: 'ProseMirror', name: 'ProseMirror' },
    { id: 'milkdown', name: 'Milkdown' },
    { id: 'Quill', name: 'Quill' },
    { id: 'Tiptap', name: 'Tiptap' },
    { id: 'Editorjs', name: 'Editorjs' },
    { id: 'Summernote', name: 'Summernote' },
    { id: 'Lexical', name: 'Lexical' },
    { id: 'Trix', name: 'Trix' },
    { id: 'MediumEditor', name: 'MediumEditor' },
    { id: 'Platejs', name: 'Platejs' },
    { id: 'Slatejs', name: 'Slatejs' },
    { id: 'Blocknotejs', name: 'Blocknotejs' },
    // { id: 'unknown', name: '未知编辑器' },
];

interface EditorMetaPluginLike {
    name?: string;
    editorAdapter: {
        editorType?: string;
        displayName?: string;
    };
}

export function mergeEditorMeta(plugins: EditorMetaPluginLike[] = []): EditorMeta[] {
    const merged = new Map<string, EditorMeta>()

    for (const meta of EDITOR_META) {
        merged.set(meta.id, meta)
    }

    for (const plugin of plugins) {
        const editorType = plugin.editorAdapter.editorType?.trim()
        if (!editorType) {
            continue
        }

        merged.set(editorType, {
            id: editorType,
            name: plugin.editorAdapter.displayName?.trim() || plugin.name?.trim() || editorType,
        })
    }

    return Array.from(merged.values())
}
