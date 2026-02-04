
export type EditorType =
    | 'nodeseek'
    | 'V2EX'
    | 'lowendtalk'
    | 'Discuz'
    | 'Typecho'
    | 'Halo'
    | 'phpBB'
    | 'CodeMirror5'
    | 'CodeMirror6'
    | 'GutenbergEditor'
    | 'TinyMCE'
    | 'wangEditor'
    | 'CKEditor4'
    | 'CKEditor5'
    | 'UEditor'
    | 'ProseMirror'
    | 'milkdown'
    | 'Quill'
    | 'Tiptap'
    | 'unknown';

export interface EditorMeta {
    id: EditorType;
    name: string;
}

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
    // { id: 'unknown', name: '未知编辑器' },
];
