/**
 * Offscreen Document Script (离屏文档脚本)
 * 
 * 角色: Broker & Proxy (中转代理)
 * 职责:
 * 1. 消息路由: 接收来自 Background 的 EXECUTE_PLUGIN 消息，并通过 postMessage 转发给 Sandbox iframe。
 * 2. 网络代理 (Proxy Fetch):
 *    - 接收来自 Sandbox 的 FETCH_REQUEST。
 *    - 使用 XMLHttpRequest (为了支持进度条) 发起真实网络请求。
 *    - 支持 FormData 的自动重建（解决 postMessage 无法传输 FormData 的问题）。
 * 3. 结果回传: 将执行结果或进度信息通过 chrome.runtime.sendMessage 主动推送到 Background。
 */

import browser from 'webextension-polyfill'

const iframe = document.getElementById('sandbox-frame') as HTMLIFrameElement | null;
if (!iframe) {
    throw new Error('[Offscreen] Sandbox iframe not found');
}

const sandboxUrl = browser.runtime.getURL('src/sandbox/index.html');

let isSandboxReady = false;
let isSandboxLoaded = false;
let currentSandboxUrl = '';
let sandboxLoadPromise: Promise<void> | null = null;
let resolveSandboxLoad: (() => void) | null = null;
let sandboxReadyPromise: Promise<void> | null = null;

const sandboxReadyResolvers: (() => void)[] = [];
const pendingExecutions = new Map<string, (response: any) => void>();

const resetSandboxState = () => {
    isSandboxReady = false;
    isSandboxLoaded = false;
    sandboxReadyPromise = null;
    sandboxLoadPromise = new Promise<void>((resolve) => {
        resolveSandboxLoad = resolve;
    });
};

const ensureSandboxFrame = async () => {
    if (currentSandboxUrl !== sandboxUrl) {
        resetSandboxState();
        currentSandboxUrl = sandboxUrl;
        iframe.src = sandboxUrl;
    }

    if (!isSandboxLoaded && sandboxLoadPromise) {
        await sandboxLoadPromise;
    }
};

const waitForSandboxReady = async () => {
    await ensureSandboxFrame();

    if (isSandboxReady) {
        return;
    }

    if (!sandboxReadyPromise) {
        sandboxReadyPromise = new Promise<void>((resolve) => {
            const pingSandbox = () => {
                iframe.contentWindow?.postMessage({ type: 'PING' }, '*');
            };

            const handleReady = () => {
                clearInterval(pingInterval);
                clearTimeout(timeoutId);
                const idx = sandboxReadyResolvers.indexOf(handleReady);
                if (idx !== -1) {
                    sandboxReadyResolvers.splice(idx, 1);
                }
                resolve();
            };

            const pingInterval = setInterval(() => {
                if (isSandboxReady) {
                    handleReady();
                    return;
                }
                pingSandbox();
            }, 500);

            const timeoutId = setTimeout(() => {
                console.warn('[Offscreen] Sandbox ready timeout');
                handleReady();
            }, 5000);

            sandboxReadyResolvers.push(handleReady);
            pingSandbox();
        }).finally(() => {
            sandboxReadyPromise = null;
        });
    }

    await sandboxReadyPromise;
};

iframe.addEventListener('load', () => {
    isSandboxLoaded = true;
    isSandboxReady = false;
    resolveSandboxLoad?.();
    resolveSandboxLoad = null;
});

// @ts-ignore
browser.runtime.onMessage.addListener((msg: any, sender: browser.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (msg.type === 'PING') {
        waitForSandboxReady()
            .then(() => sendResponse('PONG'))
            .catch((err) => {
                console.error('[Offscreen] Sandbox health check failed', err);
                sendResponse(undefined);
            });
        return true;
    }

    if (msg.type === 'EXECUTE_PLUGIN') {
        const execute = async () => {
            await waitForSandboxReady();

            if (!iframe.contentWindow) {
                console.error('[Offscreen] Sandbox iframe contentWindow missing');
                sendResponse({ error: 'Sandbox iframe not ready' });
                return;
            }
            
            const executionId = msg.id || Math.random().toString(36);
            pendingExecutions.set(executionId, sendResponse);

            setTimeout(() => {
                if (pendingExecutions.has(executionId)) {
                    const send = pendingExecutions.get(executionId);
                    if (send) send({ error: 'Plugin execution timed out (30s)' });
                    pendingExecutions.delete(executionId);
                }
            }, 30000);
            
            iframe.contentWindow.postMessage({
                type: 'EXECUTE',
                id: executionId,
                script: msg.script,
                inputs: msg.inputs,
                file: msg.file,
                mode: msg.mode || 'upload'
            }, '*');
        };

        void execute();
        return true;
    }
});

window.addEventListener('message', async (event) => {
    if (event.source !== iframe.contentWindow) {
        return;
    }

    const data = event.data;
    if (!data) return;

    if (data.type === 'SANDBOX_READY') {
        isSandboxReady = true;
        sandboxReadyResolvers.splice(0).forEach(resolve => resolve());
        return;
    }

    if (data.type === 'EXECUTE_RESULT') {
        const taskId = data.id;

        // @ts-ignore
        browser.runtime.sendMessage({
            type: 'PLUGIN_EXECUTION_RESULT',
            taskId,
            success: !data.error,
            result: data.result,
            error: data.error
        });
        
        pendingExecutions.delete(taskId);
    }
    
    if (data.type === 'FETCH_REQUEST') {
        const { requestId, url, options, taskId } = data;
        try {
            if (options.body && options.body.__type === 'FormData') {
                const fd = new FormData();
                for (const [key, value] of options.body.entries) {
                    fd.append(key, value);
                }
                options.body = fd;
            }

            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', url);
            
            if (options.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    xhr.setRequestHeader(key, value as string);
                }
            }
            
            if (xhr.upload && taskId) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        // @ts-ignore
                        browser.runtime.sendMessage({
                            type: 'PLUGIN_PROGRESS',
                            taskId,
                            percent
                        }).catch(() => {});
                    }
                };
            }

            xhr.onload = () => {
                const headers: Record<string, string> = {};
                const headerLines = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/);
                headerLines.forEach(line => {
                    const parts = line.split(': ');
                    const header = parts.shift();
                    const value = parts.join(': ');
                    if (header) headers[header.toLowerCase()] = value;
                });

                let body: any = xhr.responseText;
                const contentType = xhr.getResponseHeader('content-type') || '';
                if (contentType.includes('application/json')) {
                    try {
                        body = JSON.parse(xhr.responseText);
                    } catch { }
                }

                const responseData = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers,
                    body
                };
                 
                iframe.contentWindow?.postMessage({
                    type: 'FETCH_RESULT',
                    requestId,
                    response: {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        ...responseData
                    }
                }, '*');
            };
            
            xhr.onerror = () => {
                console.error('Proxy Fetch XHR Error');
                iframe.contentWindow?.postMessage({
                    type: 'FETCH_RESULT',
                    requestId,
                    error: 'Network Error'
                }, '*');
            };

            xhr.send(options.body);
        } catch (err: any) {
            console.error('Proxy Fetch Error:', err);
            iframe.contentWindow?.postMessage({
                type: 'FETCH_RESULT',
                requestId,
                error: err.message
            }, '*');
        }
    }
});


