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
 * 
 * 对应架构文档: plugins/plugin_architecture.md # Offscreen Document
 */

const iframe = document.getElementById('sandbox-frame') as HTMLIFrameElement;
import browser from 'webextension-polyfill'


let isSandboxReady = false;
// 等待 Sandbox 就绪的 Promise 队列
const sandboxReadyResolvers: (() => void)[] = [];

// 待处理请求映射表 (ExecutionID -> sendResponse)
// 用于跟踪来自 Background 的 EXECUTE_PLUGIN 请求，以便在需要时回复
const pendingExecutions = new Map<string, (response: any) => void>();

// 1. 监听来自 Background 的消息
// @ts-ignore
browser.runtime.onMessage.addListener((msg: any, sender: browser.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    // 健康检查 PING
    if (msg.type === 'PING') {
        sendResponse('PONG');
        return;
    }

    // 处理插件执行请求
    if (msg.type === 'EXECUTE_PLUGIN') {
        console.log('[Offscreen] Received EXECUTE_PLUGIN', msg.id);
        const execute = async () => {
             // 等待 Sandbox 就绪
            if (!isSandboxReady) {
                console.log('[Offscreen] Waiting for sandbox ready...');
                
                // 唤醒循环：尝试发送 PING 给 Sandbox 以触发其初始化
                const pingInterval = setInterval(() => {
                    if (isSandboxReady) {
                        clearInterval(pingInterval);
                        return;
                    }
                    if (iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'PING' }, '*');
                    }
                }, 500);

                // 等待 SANDBOX_READY 信号
                await new Promise<void>((resolve) => {
                    sandboxReadyResolvers.push(resolve);
                    // 超时回退 (5秒)
                    setTimeout(() => {
                        const idx = sandboxReadyResolvers.indexOf(resolve);
                        if (idx !== -1) {
                            sandboxReadyResolvers.splice(idx, 1);
                            console.warn('[Offscreen] Sandbox ready timeout');
                            resolve(); 
                        }
                    }, 5000);
                });
                clearInterval(pingInterval);
            } else {
                console.log('[Offscreen] Sandbox already ready');
            }

            // 转发消息给 Sandbox iframe
            if (!iframe.contentWindow) {
                console.error('[Offscreen] Sandbox iframe contentWindow missing');
                sendResponse({ error: 'Sandbox iframe not ready' });
                return;
            }
            
            const executionId = msg.id || Math.random().toString(36);
            pendingExecutions.set(executionId, sendResponse);

            // 安全超时 (30秒)
            setTimeout(() => {
                if (pendingExecutions.has(executionId)) {
                     const send = pendingExecutions.get(executionId);
                     if(send) send({ error: 'Plugin execution timed out (30s)' });
                     pendingExecutions.delete(executionId);
                }
            }, 30000);
            
            console.log('[Offscreen] Posting message to sandbox', executionId);
            iframe.contentWindow.postMessage({
                type: 'EXECUTE',
                id: executionId,
                script: msg.script,
                inputs: msg.inputs,
                file: msg.file
            }, '*');
        };

        execute();
        return true; // 保持消息通道打开 (异步响应)
    }
});

// 2. 监听来自 Sandbox iframe 的消息
window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data) return;

    // 处理 Sandbox 就绪信号
    if (data.type === 'SANDBOX_READY') {
        console.log('Sandbox is ready');
        isSandboxReady = true;
        // 唤醒所有等待的任务
        sandboxReadyResolvers.forEach(resolve => resolve());
        sandboxReadyResolvers.length = 0;
        return;
    }

    // 处理插件执行结果
    if (data.type === 'EXECUTE_RESULT') {
        const taskId = data.id;
        console.log('[Offscreen] Sending result back to background via sendMessage', taskId);
        
        // 使用 runtime.sendMessage 主动推送结果给 Background
        // 而不是使用 sendResponse，以避免长连接超时问题
        // @ts-ignore
        browser.runtime.sendMessage({
            type: 'PLUGIN_EXECUTION_RESULT',
            taskId: taskId,
            success: !data.error,
            result: data.result,
            error: data.error
        });
        
        // 清理 pending 映射
        pendingExecutions.delete(taskId);
    }
    
    // 处理网络请求代理 (FETCH_REQUEST)
    // Sandbox 无法直接访问网络，必须通过 Offscreen 代理
    if (data.type === 'FETCH_REQUEST') {
        const { requestId, url, options, taskId } = data;
        try {
            // 重建 FormData 对象
            // 因为 FormData 无法通过 postMessage 完整传输，Sandbox 会将其序列化为特定格式
            if (options.body && options.body.__type === 'FormData') {
                const fd = new FormData();
                for (const [key, value] of options.body.entries) {
                    fd.append(key, value);
                }
                options.body = fd;
            }

            // 在 Offscreen 上下文中执行请求
            // 注意：为了支持上传进度监听，我们使用 XMLHttpRequest 而不是 fetch
            
            const xhr = new XMLHttpRequest();
            xhr.open(options.method || 'GET', url);
            
            // 设置请求头
            if (options.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    xhr.setRequestHeader(key, value as string);
                }
            }
            
            // 监听上传进度
            if (xhr.upload && taskId) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        // 报告进度给 Background
                        // @ts-ignore
                        browser.runtime.sendMessage({
                            type: 'PLUGIN_PROGRESS',
                            taskId: taskId,
                            percent: percent
                        }).catch(() => {}); // 忽略错误（如 Background 已关闭）
                    }
                };
            }

            // 请求完成处理
            xhr.onload = () => {
                 const headers: Record<string, string> = {};
                 const headerLines = xhr.getAllResponseHeaders().trim().split(/[\r\n]+/);
                 headerLines.forEach(line => {
                     const parts = line.split(': ');
                     const header = parts.shift();
                     const value = parts.join(': ');
                     if (header) headers[header.toLowerCase()] = value;
                 });

                 // 根据 content-type 解析响应体
                 let body: any = xhr.responseText;
                 const contentType = xhr.getResponseHeader('content-type') || '';
                 if (contentType.includes('application/json')) {
                     try {
                        body = JSON.parse(xhr.responseText);
                     } catch(e) { /* ignore */ }
                 }

                 const responseData = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: headers,
                    body: body
                 };
                 
                 // 返回结果给 Sandbox
                 if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'FETCH_RESULT',
                        requestId,
                        response: {
                            ok: xhr.status >= 200 && xhr.status < 300,
                            ...responseData
                        }
                    }, '*');
                }
            };
            
            // 网络错误处理
            xhr.onerror = () => {
                console.error('Proxy Fetch XHR Error');
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage({
                        type: 'FETCH_RESULT',
                        requestId,
                        error: 'Network Error'
                    }, '*');
                }
            };

            // 发送请求
            xhr.send(options.body);
            
        } catch (err: any) {
            console.error('Proxy Fetch Error:', err);
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'FETCH_RESULT',
                    requestId,
                    error: err.message
                }, '*');
            }
        }
    }
    
    // 冗余的就绪检查日志
    if (data.type === 'SANDBOX_READY') {
        console.log('Sandbox is ready');
    }
});
