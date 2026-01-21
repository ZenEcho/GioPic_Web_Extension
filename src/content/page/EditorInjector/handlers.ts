import type {
    CKEditor5Type,
    WangEditorType,
    CodeMirrorElementType
} from '../EditorInjector/types';

export function handleDiscuz(url: string): boolean {
    const discuz = document.getElementById("fastpostmessage") as HTMLTextAreaElement | HTMLInputElement | null;
    const discuzInteractiveReply = document.getElementById("postmessage") as HTMLTextAreaElement | HTMLInputElement | null;
    const discuzAdvanced = document.getElementById("e_textarea");

    if (discuzInteractiveReply) {
        //回复楼层
        discuzInteractiveReply.value += '[img]' + url + '[/img]';
        return true;
    } else if (discuz) {
        //回复楼主
        discuz.value += '[img]' + url + '[/img]';
        return true;
    }

    if (discuzAdvanced && discuzAdvanced.parentNode) {
        //高级回复
        let discuzAdvancedIframe: HTMLIFrameElement | null;
        try {
            discuzAdvancedIframe = discuzAdvanced.parentNode.querySelector("iframe") as HTMLIFrameElement | null;
            if (discuzAdvancedIframe && discuzAdvancedIframe.contentDocument) {
                let bodyElement = discuzAdvancedIframe.contentDocument.body;
                let img = document.createElement('img');
                img.src = url;
                bodyElement.appendChild(img);
                return true;
            }
            else {
                (discuzAdvanced as HTMLTextAreaElement | HTMLInputElement).value += '[img]' + url + '[/img]';
                return true;
            }
        } catch (error) {
            return false;
        }
    }
    return false;
}

export function handleCodeMirror5(url: string): boolean {
    let editorElement = document.querySelector(".CodeMirror") as CodeMirrorElementType | null;
    if (editorElement && editorElement.CodeMirror) {
        const content = editorElement.CodeMirror.getValue();
        const newContent = content + `![image](${url})`;
        editorElement.CodeMirror.setValue(newContent);
        return true;
    }
    return false;
}

export function handleCodeMirror6(url: string): boolean {
    let codeMirror6 = document.querySelector(".cm-content");
    if (codeMirror6) {
        let item = document.createElement('div');
        item.className = "cm-line";
        item.dir = "auto";
        item.innerText = '![' + "image" + '](' + url + ')';
        codeMirror6.appendChild(item);
        return true;
    }
    return false;
}

export function handleV2ex(url: string): boolean {
    // 1. 尝试处理发帖场景 (CodeMirror5)
    // V2EX 发帖页面通常使用 CodeMirror5，如果有 .CodeMirror 元素，优先尝试使用 CodeMirror5 的处理逻辑
    if (document.querySelector(".CodeMirror")) {
        if (handleCodeMirror5(url)) {
            return true;
        }
    }

    // 2. 处理回帖场景 (普通文本框)
    const replyContent = document.getElementById("reply_content") as HTMLTextAreaElement | HTMLInputElement | null;
    if (replyContent) {
        // V2EX 回帖通常支持 Markdown 或纯文本，直接追加 URL
        // 确保前有空格，避免粘连
        const prefix = replyContent.value ? '\n' : '';
        replyContent.value += `${prefix}${url}`;
        
        // 触发 input 事件以通知页面数据更新（针对某些响应式框架或验证逻辑）
        const inputEvent = new Event('input', { bubbles: true });
        replyContent.dispatchEvent(inputEvent);
        return true;
    }

    return false;
}

export function handleHalo(url: string): boolean {
    let haloEditorElement = document.querySelector('.ProseMirror') as HTMLElement;
    if (haloEditorElement) {
        haloEditorElement.focus();
        document.execCommand('insertImage', false, url);
        return true;
    }
    return false;
}

export function handleLowEndTalk(url: string): boolean {
    const lowendtalkEditor = document.getElementById("Form_Body") as HTMLInputElement;
    if (lowendtalkEditor) {
        lowendtalkEditor.value += '![' + "图片" + '](' + url + ')';
        return true;
    }
    return false;
}

export function handleTypecho(url: string): boolean {
    let text = document.getElementById("text") as HTMLTextAreaElement | HTMLInputElement | null;
    if (text) {
        text.value += '![' + "image" + '](' + url + ')';
        let inputEvent = new Event('input', { bubbles: true });
        text.dispatchEvent(inputEvent);
        return true;
    }
    return false;
}

export function handlePHPBB(url: string): boolean {
    let phpbbForum = document.getElementById("phpbb");
    if (phpbbForum) {
        window.postMessage({ type: 'phpbbForum', data: '[img]' + url + '[/img]' }, '*');
        return true;
    }
    return false;
}

export function handleGutenberg(url: string): boolean {
    try {
        const gutenberg = window.wp?.data.dispatch('core/block-editor');
        if (gutenberg) {
            const imageBlock = window.wp?.blocks.createBlock('core/image', { url: url });
            gutenberg.insertBlock(imageBlock);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

export function handleTinyMCE(url: string): boolean {
    try {
        let tinyMCE = window.tinymce?.activeEditor;
        if (tinyMCE) {
            tinyMCE.execCommand('mceInsertContent', false, url);
            window.postMessage({ type: 'TinyMCEResponse', status: 'success', data: 'true' }, '*');
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

export function handleWangEditor(url: string): boolean {
    try {
        const editor = window.editor as WangEditorType | undefined;
        // Check if it matches WangEditor signature
        if (editor && typeof editor.getEditableContainer === 'function') {
             const wangEditorElement = editor.getEditableContainer();
             if (wangEditorElement) {
                editor.dangerouslyInsertHtml(url);
                return true;
             }
        }
        return false;
    } catch (error) {
        return false;
    }
}

export function handleCKEditor4(url: string): boolean {
    try {
        const ckeditor4 = window.CKEDITOR?.instances?.ckdemoarticle;
        if (ckeditor4) {
            ckeditor4.insertHtml(url);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

export function handleCKEditor5(url: string): boolean {
    try {
        const editor = window.editor as CKEditor5Type | undefined;
        // Check if it matches CKEditor5 signature
        if (editor && typeof editor.getData === 'function' && typeof editor.setData === 'function') {
            const content = editor.getData();
            editor.setData(content + url);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}

export function handleUEditor(url: string): boolean {
    try {
        const UE = window.UE;
        let ueditorElement = UE?.getEditor("editor_content");
        if (ueditorElement) {
            ueditorElement.execCommand('insertimage', {
                src: url,
            });
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
}
