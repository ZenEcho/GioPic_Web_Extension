
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
    return document.querySelector(selector) ? { type: id, certainty, source: `selector: ${selector}` } : null;;
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
            // 1. 检查 Meta Generator (最准确，最快)
            const isDiscuzMeta = document.querySelector("meta[name='generator'][content*='Discuz']") != null;
            if (isDiscuzMeta) {
                return { type: 'Discuz', certainty: 1, source: 'MetaGenerator' };
            }
            const bodyId = document.body.id;
            if (bodyId && (bodyId.startsWith('nv_') || bodyId === 'discuz_uid')) {
                return { type: 'Discuz', certainty: 0.95, source: 'BodyID' };
            }
            // 3. 检查 Discuz 特有的核心元素 ID
            if (document.getElementById('discuz_tips') ||
                (document.getElementById('toptb') && document.getElementById('ft'))) {
                return { type: 'Discuz', certainty: 0.9, source: 'CoreElements' };
            }
            // 4. 最后的兜底：文本检测 (优化版)
            // 并且只检测页脚区域，因为版权信息通常在那。
            const footerText = (document.getElementById('ft') || document.body).textContent || "";
            if (footerText.includes("Powered by Discuz") || footerText.includes("Discuz!")) {
                return { type: 'Discuz', certainty: 0.6, source: 'FooterTextIncludes' };
            }

            return null;
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
                if (editor && typeof editor.insertNode === 'function') {
                    editor.insertNode({
                        type: 'image',
                        src: url,
                        href: url, // 图片点击链接（可选）
                        children: [{ text: '' }] // Lexical/Slate 架构要求的空子节点
                    })

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
        detect: () => detectBySelector('.milkdown', 'milkdown', 0.9),
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
    },
    // 18. Quill
    {
        id: 'Quill',
        detect: () => detectBySelector('.ql-editor', 'Quill', 0.9),
        inject: (url: string): boolean => {
            // 1. 获取容器和实例
            const container = document.querySelector('.ql-container') as any;
            const win = container?.ownerDocument?.defaultView || window;
            // 尝试所有可能的挂载路径
            const quill = (win as any).myQuill
                || container?.__quill
                || container?._quill
                || container?.quill;

            try {
                // 场景 A: 成功获取 Quill 实例
                if (quill) {
                    // 获取光标位置，如果没有光标则插入到末尾
                    const range = quill.getSelection(true);
                    const index = range ? range.index : quill.getLength();

                    quill.insertEmbed(index, 'image', url, 'user');
                    // 将光标移动到图片之后
                    quill.setSelection(index + 1, 'user');
                    return true;
                }

                // 场景 B: 没有实例，尝试原生 DOM 操作兜底
                if (container) {
                    container.focus();
                    const imgHtml = `<img src="${url}" />`;
                    // execCommand 已废弃但控制台环境下依然常用
                    const success = document.execCommand('insertHTML', false, imgHtml);
                    return success;
                }

                return false;
            } catch (error) {
                console.error('Quill 注入失败:', error);
                return false;
            }
        }
    },
    // 19.Tiptap
    {
        id: 'Tiptap',
        detect: () => detectBySelector('.tiptap.ProseMirror', 'Tiptap', 0.9),
        inject: (url) => {
            // 1. 寻找编辑器实例
            const container = document.querySelector('.tiptap.ProseMirror');
            const editor = (window as any).editor || (container as any)?.__tiptapEditor || (container as any)?.editor;

            if (!editor) {
                console.error('未找到编辑器实例');
                return false;
            }

            try {
                // 2. 优先尝试标准 setImage (性能和格式最好)
                // 检查 commands.setImage 是否存在，避免抛出 Uncaught TypeError
                if (typeof editor.commands.setImage === 'function') {
                    editor.chain().focus().setImage({ src: url }).run();
                    return true;
                }
                editor.commands.insertContent(`<img src="${url}" />`);

                // 4. 最后校验：如果还是没焦点或没内容，强制 focus 一下
                editor.commands.focus();
                return true;

            } catch (err) {
                console.error('插入图片失败:', err);
                return false;
            }
        }
    },
    // 20. Editorjs
    {
        id: 'Editorjs',
        detect: () => {
            // id:id="editorjs"
            // class:class="codex-editor__redactor"
            const editorjs = document.querySelector('#editorjs');
            if (!editorjs) {
                return null;
            }
            // 检查是否有 codex-editor__redactor 类
            if (!editorjs.querySelector('.codex-editor__redactor')) {
                return null;
            }
            return { type: 'Editorjs', certainty: 0.95, source: 'id: editorjs' };
        },
        inject: async (url) => {
            try {
                // EditorJS 通常基于 Block 结构
                // 优先使用直接插入 img 标签 (响应最快，用户体验好)

                // 1. 获取当前获得焦点的可编辑块
                let targetBlock = document.activeElement as HTMLElement;

                // 如果当前焦点不在编辑器内，尝试查找第一个空段落
                if (!targetBlock || !targetBlock.closest('.codex-editor')) {
                    targetBlock = document.querySelector('.ce-paragraph[contenteditable="true"]') as HTMLElement;
                }

                if (!targetBlock) {
                    console.warn('[EditorJS] No focusable block found');
                    return false;
                }

                targetBlock.focus();
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const file = new File([blob], "image.png", { type: blob.type });

                    const dt = new DataTransfer();
                    dt.items.add(file);

                    const pasteEvent = new ClipboardEvent("paste", {
                        clipboardData: dt,
                        bubbles: true,
                        cancelable: true
                    });

                    targetBlock.dispatchEvent(pasteEvent);
                    console.log('[EditorJS] Injected via paste simulation');
                    return true;
                } catch (fetchError) {
                    console.warn('[EditorJS] Paste simulation failed', fetchError);
                }

                try {
                    const img = document.createElement("img");
                    img.src = url;

                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(img);

                        // 移动光标到图片后
                        range.collapse(false);
                        console.log('[EditorJS] Injected via direct DOM insertion');
                        return true;
                    }
                } catch (e) {
                    console.warn('[EditorJS] Direct insertion failed, falling back to paste simulation', e);
                }




                return false;
            } catch (e) {
                console.error('[EditorJS] Injection failed', e);
                return false;
            }
        }
    },
    // 21. summernote
    {
        id: 'Summernote',
        detect: () => detectBySelector('.note-editable', 'Summernote', 0.8),
        inject: (url) => {
            try {
                // 1. 获取 jQuery (Summernote 必须依赖它)
                const $ = (window as any).jQuery || (window as any).$;
                if (!$) return false;

                // 2. 找到编辑区并反向定位到原始实例元素
                const editable = document.querySelector('.note-editable');
                if (!editable) return false;

                // Summernote 实例通常挂在 .note-editor 之前的那个元素上
                const $editorContainer = $(editable).closest('.note-editor');
                const $target = $editorContainer.prev();

                // 3. 执行插入
                if (typeof ($target as any).summernote === 'function') {
                    $target.summernote('insertImage', url);
                    return true;
                }

                // 4. 兜底方案：如果 API 调用失败，直接操作 DOM
                $(editable).focus();
                document.execCommand('insertImage', false, url);
                return true;

            } catch (err) {
                console.error('Summernote 注入失败:', err);
                return false;
            }
        }
    },
    // 22.lexical
    {
        id: 'Lexical',
        detect: () => {
            const editor = (document.querySelector(".ContentEditable__root") as any)?.__lexicalEditor;
            return editor ? {
                type: 'Lexical',
                certainty: 0.95,
                source: 'Lexical 编辑器实例'
            } : null;
        },
        inject: (url: string): boolean => {
            try {
                // 1. 获取实例
                const el = (document.querySelector(".ContentEditable__root") as HTMLElement & { __lexicalEditor?: any });
                const editor = el?.__lexicalEditor;
                if (!el || !editor) return false;

                try {
                    // 方案一：尝试使用 Lexical API 更新
                    let apiSuccess = false;
                    editor.update(() => {
                        // 1. 获取 Lexical 核心类 (假设 Playground 中的 ImageNode 存在)
                        // 你可能需要根据实际情况调整 'image' 这个键
                        const ImageNode = editor._nodes.get('image')?.klass; // 尝试获取 ImageNode 类

                        // 如果没有 ImageNode，说明可能不支持直接插入 Image 节点，跳过API更新，使用兜底粘贴
                        if (!ImageNode) {
                            return;
                        }

                        const ParagraphNode = editor._nodes.get('paragraph').klass;
                        const root = editor._editorState._nodeMap.get('root');

                        const imageNode = new ImageNode(url, "image");
                        const paragraph = new ParagraphNode();
                        paragraph.append(imageNode);
                        root.append(paragraph);
                        apiSuccess = true;
                    }, { tag: 'history-merge' });

                    if (apiSuccess) return true;
                } catch (error) {
                    console.warn('Lexical API 注入失败，尝试模拟粘贴:', error);
                }

                // 方案二：模拟 HTML 粘贴 (兜底方案)
                // 适用于没有 ImageNode 或 API 调用失败的情况
                try {
                    el.focus();

                    // 构建包含图片的 HTML 字符串
                    const htmlContent = `<p><img src="${url}" alt="image" style="max-width: 100%;"></p>`;

                    // 创建一个 DataTransfer 对象
                    const clipboardData = new DataTransfer();
                    clipboardData.setData('text/html', htmlContent); // 设置 HTML 数据
                    clipboardData.setData('text/plain', `[Image: ${url}]`); // 也设置纯文本数据，以防万一

                    const pasteEvent = new ClipboardEvent('paste', {
                        clipboardData: clipboardData,
                        bubbles: true,
                        cancelable: true
                    });

                    el.dispatchEvent(pasteEvent);
                    console.log("Lexical: 模拟粘贴图片 HTML 成功！");
                    return true;
                } catch (pasteError) {
                    console.error('Lexical 模拟粘贴失败:', pasteError);
                    return false;
                }

            } catch (err) {
                console.error('Lexical 注入失败:', err);
                return false;
            }
        }
    },
    // 23.trix
    {
        id: 'Trix',
        detect: () => {
            const editor = (document.querySelector(".trix-content") as any)?.editor;
            return editor ? {
                type: 'Trix',
                certainty: 0.95,
                source: 'Trix 编辑器实例'
            } : null;
        },
        inject: (url: string): boolean => {
            // 1. 获取实例
            const el = (document.querySelector(".trix-content") as HTMLElement & { editor?: any });
            const editor = el?.editor;
            if (!el || !editor) return false;
            try {
                const Trix = (window as any).Trix;
                if (!Trix || !Trix.Attachment) {
                    console.error('Trix 未加载或版本不兼容');
                    return false;
                }
                const attachment = new Trix.Attachment({
                    contentType: "image/png",
                    url: url,
                    filename: url.split('/').pop() || 'image.png',
                });

                editor.insertAttachment(attachment);;
                return true;
            } catch (err) {
                console.error('Trix 注入失败:', err);
                return false;
            }
        }

    },
    // 24 .MediumEditor
    {
        id: 'MediumEditor',
        detect: () => {
            const editor = (window as any).editor || (window as any)._mediumEditors;
            return editor ? {
                type: 'MediumEditor',
                certainty: 0.90,
                source: 'MediumEditor 编辑器实例'
            } : null;
        },
        inject: (url: string): boolean => {
            const editors = (window as any)._mediumEditors;

            // 增加空值检查，并确保 editors 是数组且其中元素不为 null/undefined
            if (!editors || !Array.isArray(editors)) return false;

            // 安全查找包含 elements 属性的编辑器实例
            const editor = editors.find((item: any) => item && item.elements && item.elements.length > 0);

            if (!editor) return false;
            try {
                const imageHtml = `<img src="${url}" alt="" style="max-width: 100%;">`;
                // pasteHTML 是 MediumEditor 的标准 API
                if (typeof editor.pasteHTML === 'function') {
                    editor.pasteHTML(imageHtml);
                    return true;
                }
            } catch (err) {
                console.error('MediumEditor pasteHTML 注入失败:', err);
            }

            // 兜底方案
            try {
                if (editor.elements && editor.elements[0]) {
                    editor.elements[0].focus();
                    document.execCommand('insertImage', false, url);
                    return true;
                }
            } catch (err) {
                console.error('MediumEditor 原生注入失败:', err);
            }
            return false;
        }
    },
    // 25 .platejs
    {
        id: 'Platejs',
        detect: () => {
            const editor = findPlateEditor();
            return editor ? {
                type: 'Platejs',
                certainty: 0.9,
                source: 'Platejs 编辑器实例'
            } : null;
        },
        inject: (url: string) => {
            try {
                const editor = findPlateEditor();
                if (!editor) return false;
                const imageNode = {
                    type: 'img',
                    url: url,
                    children: [{ text: '' }]
                };

                // 执行插入
                editor.insertNodes(imageNode);
                return true;
            } catch (err) {
                console.error('Platejs 注入失败:', err);
                return false;
            }
        }
    },
    // 26 .slatejs
    {
        id: 'Slatejs',
        detect: () => {
            const editor = findSlateEditor();
            return editor ? {
                type: 'Slatejs',
                certainty: 0.95,
                source: 'Slatejs 编辑器实例'
            } : null;
        },
        inject: (url: string) => {
            try {
                const editor = findSlateEditor();
                if (!editor) return false;
                const imageNode = {
                    type: 'image', // 官网 Demo 通常使用 'image'
                    url: url,
                    children: [{ text: '' }] // Slate 要求所有元素节点必须包含 children
                };

                editor.apply({
                    type: 'insert_node',
                    path: [editor.children.length], // 插入到文档最后
                    node: imageNode
                });
                return true;
            } catch (err) {
                console.error('Slatejs 注入失败:', err);
                return false;
            }
        }
    },
    // 27 .Blocknotejs
    {
        id: 'Blocknotejs',
        detect: () => {
            const editor = findBlocknoteEditor();
            return editor ? {
                type: 'Blocknotejs',
                certainty: 0.96,
                source: 'Blocknotejs 编辑器实例'
            } : null;
        },
        inject: (url: string) => {
            try {
                const editor = findBlocknoteEditor();
                if (!editor) return false;
                editor.insertBlocks(
                    [
                        {
                            type: "image",
                            props: {
                                url: url,
                                caption: "image",
                                showPreview: true
                            }
                        }
                    ],
                    editor.getTextCursorPosition().block,
                    "after"
                )
                return true;
            } catch (err) {
                console.error('Blocknotejs 注入失败:', err);
                return false;
            }
        }
    }

];

const findPlateEditor = () => {
    const root = document.querySelector('[contenteditable="true"]');
    const key = root ? Object.keys(root).find(k => k.startsWith('__reactFiber')) : undefined;
    const fiber = key ? (root as any)[key] : undefined;

    // 递归寻找包含 slate editor 的 context
    let curr = fiber;
    while (curr) {
        if (curr.pendingProps && curr.pendingProps.editor) {
            return curr.pendingProps.editor;
        }
        if (curr.memoizedProps && curr.memoizedProps.editor) {
            return curr.memoizedProps.editor;
        }
        curr = curr.return;
    }

};
//查找Slate编辑器实例
const findSlateEditor = () => {
    const slateRoot = document.querySelector('[data-slate-editor="true"]');

    // 2. 通过 React Fiber 抓取实例
    const getSlateEditor = (el: HTMLElement) => {
        const fiberKey = Object.keys(el).find(key => key.startsWith('__reactFiber'));
        let curr = fiberKey ? (el as any)[fiberKey] : undefined;
        while (curr) {
            // Slate 会把 editor 实例放在 context 或 props 中
            if (curr.pendingProps && curr.pendingProps.editor) return curr.pendingProps.editor;
            if (curr.memoizedProps && curr.memoizedProps.editor) return curr.memoizedProps.editor;
            curr = curr.return;
        }
    };
    return slateRoot ? getSlateEditor(slateRoot as HTMLElement) : undefined;
};
const findBlocknoteEditor = () => {
    const bnRoot = document.querySelector(".bn-editor");
    // 2. 抓取实例
    const getBlockNoteEditor = (el: any) => {
        const fiberKey = Object.keys(el).find(key => key.startsWith('__reactFiber'));
        let curr = fiberKey ? el[fiberKey] : undefined;
        while (curr) {
            // BlockNote 会在 props 中保留 editor 引用
            if (curr.pendingProps && curr.pendingProps.editor) return curr.pendingProps.editor;
            if (curr.memoizedProps && curr.memoizedProps.editor) return curr.memoizedProps.editor;
            curr = curr.return;
        }
    };
    return bnRoot ? getBlockNoteEditor(bnRoot) : undefined;
};