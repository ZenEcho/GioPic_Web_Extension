
import type {
    EditorAdapter,
    DetectionResult,
    WangEditorType,
    CKEditor5Type,
    CodeMirrorElementType
} from './types';

// =================================================================================
// Helper Functions
// =================================================================================

function detectBySelector(selector: string, id: any, certainty: number = 0.8): DetectionResult | null {
    return document.querySelector(selector) ? { type: id, certainty, source: `selector: ${selector}` } : null;
}

function detectById(elementId: string, id: any, certainty: number = 0.9): DetectionResult | null {
    return document.getElementById(elementId) ? { type: id, certainty, source: `id: ${elementId}` } : null;
}

function detectByDomain(domain: string, id: any, certainty: number = 1.0): DetectionResult | null {
    return window.location.hostname.includes(domain) ? { type: id, certainty, source: `domain: ${domain}` } : null;
}

function handleCodeMirror5Impl(url: string): boolean {
    let editorElement = document.querySelector(".CodeMirror") as CodeMirrorElementType | null;
    if (editorElement && editorElement.CodeMirror) {
        const content = editorElement.CodeMirror.getValue();
        const newContent = content + `![image](${url})`;
        editorElement.CodeMirror.setValue(newContent);
        return true;
    }
    return false;
}

// =================================================================================
// Adapters
// =================================================================================

export const adapters: EditorAdapter[] = [
    // 1. Discuz
    {
        id: 'Discuz',
        detect: () => {
            const bodyInnerText = document.body.innerText;
            const isDiscuz = bodyInnerText.toLowerCase().includes("discuz") || bodyInnerText.toLowerCase().includes("论坛") == true;
            return isDiscuz ? { type: 'Discuz', certainty: 0.8, source: 'TextIncludes' } : null;
        },
        inject: (url: string) => {
            const discuz = document.getElementById("fastpostmessage") as HTMLTextAreaElement | HTMLInputElement | null;
            const discuzInteractiveReply = document.getElementById("postmessage") as HTMLTextAreaElement | HTMLInputElement | null;
            const discuzAdvanced = document.getElementById("e_textarea");

            if (discuzInteractiveReply) {
                discuzInteractiveReply.value += '[img]' + url + '[/img]';
                return true;
            } else if (discuz) {
                discuz.value += '[img]' + url + '[/img]';
                return true;
            }

            if (discuzAdvanced && discuzAdvanced.parentNode) {
                try {
                    const iframe = discuzAdvanced.parentNode.querySelector("iframe") as HTMLIFrameElement | null;
                    if (iframe && iframe.contentDocument) {
                        let bodyElement = iframe.contentDocument.body;
                        let img = document.createElement('img');
                        img.src = url;
                        bodyElement.appendChild(img);
                        return true;
                    } else {
                        (discuzAdvanced as HTMLTextAreaElement | HTMLInputElement).value += '[img]' + url + '[/img]';
                        return true;
                    }
                } catch (error) {
                    return false;
                }
            }
            return false;
        }
    },

    // 2. Halo
    {
        id: 'Halo',
        detect: () => {
            const els = document.getElementsByClassName("halo-rich-text-editor");
            return els.length ? { type: 'Halo', certainty: 0.8, source: 'class: halo-rich-text-editor' } : null;
        },
        inject: (url: string) => {
            let el = document.querySelector('.ProseMirror') as HTMLElement;
            if (el) {
                el.focus();
                document.execCommand('insertImage', false, url);
                return true;
            }
            return false;
        }
    },

    // 3. Typecho
    {
        id: 'Typecho',
        detect: () => {
            const bodyInnerText = document.body.innerText;
            const typecho = bodyInnerText.toLowerCase().includes("typecho");
            const btn = document.getElementById("btn-submit");
            return typecho && btn ? { type: 'Typecho', certainty: 0.9, source: 'TextIncludes and id: btn-submit' } : null;
        },
        inject: (url: string) => {
            let text = document.getElementById("text") as HTMLTextAreaElement | HTMLInputElement | null;
            if (text) {
                text.value += '![' + "image" + '](' + url + ')';
                let inputEvent = new Event('input', { bubbles: true });
                text.dispatchEvent(inputEvent);
                return true;
            }
            return false;
        }
    },

    // 4. phpBB
    {
        id: 'phpBB',
        detect: () => {
            const phpBB = window.phpbb;
            const phpBBID = document.getElementById("phpbb");
            return phpBB && phpBBID ? { type: 'phpBB', certainty: 1, source: 'global variable and id: phpbb' } : null;
        },
        inject: (url: string) => {
            let phpbbForum = document.getElementById("phpbb");
            if (phpbbForum) {
                window.postMessage({ type: 'phpbbForum', data: '[img]' + url + '[/img]' }, '*');
                return true;
            }
            return false;
        }
    },

    // 5. V2EX
    {
        id: 'V2EX',
        detect: () => detectByDomain('v2ex.com', 'V2EX'),
        inject: (url: string) => {
            // 1. Try CodeMirror5 first (for new posts)
            if (document.querySelector(".CodeMirror")) {
                if (handleCodeMirror5Impl(url)) return true;
            }

            // 2. Reply box
            const replyContent = document.getElementById("reply_content") as HTMLTextAreaElement | HTMLInputElement | null;
            if (replyContent) {
                const prefix = replyContent.value ? '\n' : '';
                replyContent.value += `${prefix}${url}`;
                const inputEvent = new Event('input', { bubbles: true });
                replyContent.dispatchEvent(inputEvent);
                return true;
            }
            return false;
        }
    },

    // 6. NodeSeek
    {
        id: 'nodeseek',
        detect: () => detectByDomain('nodeseek.com', 'nodeseek'),
        inject: (url: string) => handleCodeMirror5Impl(url) // Reuse CodeMirror5 logic
    },

    // 7. LowEndTalk
    {
        id: 'lowendtalk',
        detect: () => detectByDomain('lowendtalk.com', 'lowendtalk'),
        inject: (url: string) => {
            const editor = document.getElementById("Form_Body") as HTMLInputElement;
            if (editor) {
                editor.value += '![' + "image" + '](' + url + ')';
                return true;
            }
            return false;
        }
    },

    // 8. CodeMirror 5
    {
        id: 'CodeMirror5',
        detect: () => detectBySelector('.CodeMirror', 'CodeMirror5'),
        inject: handleCodeMirror5Impl
    },

    // 9. CodeMirror 6
    {
        id: 'CodeMirror6',
        detect: () => detectBySelector('.cm-editor', 'CodeMirror6'),
        inject: (url: string) => {
            let cm = document.querySelector(".cm-content");
            if (cm) {
                let item = document.createElement('div');
                item.className = "cm-line";
                item.dir = "auto";
                item.innerText = '![' + "image" + '](' + url + ')';
                cm.appendChild(item);
                return true;
            }
            return false;
        }
    },

    // 10. Gutenberg (WordPress)
    {
        id: 'GutenbergEditor',
        detect: () => {
            const gutenberg = document.getElementById("wpbody-content");
            const footer = document.getElementsByClassName("interface-interface-skeleton__footer");
            return gutenberg && footer.length ? { type: 'GutenbergEditor', certainty: 0.9, source: 'id: wpbody-content' } : null;
        },
        inject: (url: string) => {
            try {
                const dispatch = window.wp?.data.dispatch('core/block-editor');
                if (dispatch) {
                    const imageBlock = window.wp?.blocks.createBlock('core/image', { url: url });
                    dispatch.insertBlock(imageBlock);
                    return true;
                }
                return false;
            } catch { return false; }
        }
    },

    // 11. TinyMCE
    {
        id: 'TinyMCE',
        detect: () => {
            try {
                return window.tinymce?.activeEditor ? { type: 'TinyMCE', certainty: 1, source: 'global: tinymce' } : null;
            } catch { return null; }
        },
        inject: (url: string) => {
            try {
                let editor = window.tinymce?.activeEditor;
                if (editor) {
                    editor.execCommand('mceInsertContent', false, url);
                    window.postMessage({ type: 'TinyMCEResponse', status: 'success', data: 'true' }, '*');
                    return true;
                }
                return false;
            } catch { return false; }
        }
    },

    // 12. wangEditor
    {
        id: 'wangEditor',
        detect: () => {
            try {
                const editor = window.editor as WangEditorType;
                return (editor && typeof editor.getEditableContainer === 'function')
                    ? { type: 'wangEditor', certainty: 1, source: 'global: editor (wangEditor)' } : null;
            } catch { return null; }
        },
        inject: (url: string) => {
            try {
                const editor = window.editor as WangEditorType | undefined;
                if (editor && typeof editor.getEditableContainer === 'function') {
                    const el = editor.getEditableContainer();
                    if (el) {
                        editor.dangerouslyInsertHtml(url);
                        return true;
                    }
                }
                return false;
            } catch { return false; }
        }
    },

    // 13. CKEditor 4
    {
        id: 'CKEditor4',
        detect: () => {
            try {
                return (window.CKEDITOR?.instances && Object.keys(window.CKEDITOR.instances).length > 0)
                    ? { type: 'CKEditor4', certainty: 1, source: 'global: CKEDITOR' } : null;
            } catch { return null; }
        },
        inject: (url: string) => {
            try {
                // Try to find the first instance or specific one
                // The original code used 'ckdemoarticle', which seems specific to a demo.
                // We'll try to iterate or use a common one if possible, but let's stick to original logic first or improve it.
                // Original logic: window.CKEDITOR?.instances?.ckdemoarticle;
                // Improved: iterate over instances
                const instances = window.CKEDITOR?.instances;
                if (instances) {
                    for (const key in instances) {
                        if (instances[key]) {
                            instances[key].insertHtml(url);
                            return true; // Inject into first found instance
                        }
                    }
                }
                return false;
            } catch { return false; }
        }
    },

    // 14. CKEditor 5
    {
        id: 'CKEditor5',
        detect: () => {
            try {
                const editor = window.editor as CKEditor5Type;
                return (editor && typeof editor.getData === 'function' && typeof editor.setData === 'function')
                    ? { type: 'CKEditor5', certainty: 1, source: 'global: editor (CKEditor5)' } : null;
            } catch { return null; }
        },
        inject: (url: string) => {
            try {
                const editor = window.editor as CKEditor5Type | undefined;
                if (editor && typeof editor.getData === 'function' && typeof editor.setData === 'function') {
                    const content = editor.getData();
                    editor.setData(content + url);
                    return true;
                }
                return false;
            } catch { return false; }
        }
    },

    // 15. UEditor
    {
        id: 'UEditor',
        detect: () => {
            try {
                return (window.UE && typeof window.UE.getEditor === 'function')
                    ? { type: 'UEditor', certainty: 1, source: 'global: UE' } : null;
            } catch { return null; }
        },
        inject: (url: string) => {
            try {
                const UE = window.UE;
                // Original used "editor_content", maybe make it more generic or robust?
                // Keeping original logic for safety.
                let editor = UE?.getEditor("editor_content");
                if (editor) {
                    editor.execCommand('insertimage', { src: url });
                    return true;
                }
                return false;
            } catch { return false; }
        }
    },

    // 16. ProseMirror
    {
        id: 'ProseMirror',
        detect: () => detectBySelector('.ProseMirror', 'ProseMirror'),
        inject: (url: string) => {
            try {
                const editor = document.querySelector(".ProseMirror") as HTMLElement;
                if (editor) {
                    editor.focus();
                    const imgHtml = `<img src="${url}" alt="image" />`;
                    const markdownText = `![](${url})`;
                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/html', imgHtml);
                    dataTransfer.setData('text/plain', markdownText);
                    const event = new ClipboardEvent('paste', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true
                    });
                    editor.dispatchEvent(event);
                    return true;
                }
                return false;
            } catch { return false; }
        }
    },

    // 17. Milkdown
    {
        id: 'milkdown',
        detect: () => detectBySelector('.milkdown', 'milkdown'),
        inject: (url: string) => {
            try {
                const editor = document.querySelector(".milkdown .ProseMirror") as HTMLElement || document.querySelector(".milkdown") as HTMLElement;
                if (editor) {
                    editor.focus();
                    const text = `![](${url})`;
                    const dataTransfer = new DataTransfer();
                    dataTransfer.setData('text/plain', text);
                    const event = new ClipboardEvent('paste', {
                        clipboardData: dataTransfer,
                        bubbles: true,
                        cancelable: true
                    });
                    editor.dispatchEvent(event);
                    return true;
                }
                return false;
            } catch { return false; }
        }
    }
];
