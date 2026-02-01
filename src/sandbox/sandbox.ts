/**
 * Sandbox Script (沙箱脚本)
 * 
 * 角色: Execution Environment (执行环境)
 * 职责:
 * 1. 代码求值: 使用 new Function(script) 安全地解析用户脚本。
 * 2. 上下文注入: 向用户脚本注入 ctx 对象（包含 fetch 代理方法）。
 * 3. 请求序列化: 拦截用户脚本发起的请求，将 FormData 等复杂对象序列化为可传输的格式。
 * 4. 通信: 通过 window.parent.postMessage 与外部 (Offscreen) 通信。
 * 
 * 对应架构文档: plugins/plugin_architecture.md # Sandbox
 */

// 执行请求接口定义
interface ExecuteRequest {
  id: string;
  type: 'EXECUTE';
  script: string;
  inputs: Record<string, any>; // 插件配置参数
  file?: {
    name: string;
    type: string;
    size: number;
    data: string; // Base64 数据
  };
}

// 辅助函数：通知父窗口 (Offscreen)
const notify = (data: any) => {
  window.parent.postMessage(data, '*');
};

// 监听来自 Offscreen 的消息
window.addEventListener('message', async (event) => {
  const { data } = event;
  
  // 处理 PING 消息 (健康检查)
  if (data.type === 'PING') {
        notify({ type: 'SANDBOX_READY' });
        return;
    }

    if (!data || data.type !== 'EXECUTE') return;
    
    console.log('[Sandbox] Received EXECUTE request', data.id);

  const { id, script, inputs, file } = data as ExecuteRequest;

  try {
    // 注入给用户脚本的上下文对象
    // 包含代理的 fetch 方法，因为沙箱内无法直接跨域访问
    const proxyFetch = async (url: string, options: any = {}) => {
       console.log('[Sandbox] Calling proxyFetch', url);
       return new Promise((resolve, reject) => {
           const requestId = Math.random().toString(36).substring(7);
           
           // 监听单次请求的结果
           const handleResponse = (e: MessageEvent) => {
               if (e.data?.type === 'FETCH_RESULT' && e.data?.requestId === requestId) {
                   window.removeEventListener('message', handleResponse);
                   if (e.data.error) reject(new Error(e.data.error));
                   else resolve(e.data.response);
               }
           };
           window.addEventListener('message', handleResponse);
           
           // 序列化 options (主要是 FormData)
           // 如果 Body 是 FormData，需要将其展开为数组格式，以便通过 postMessage 传递
           if (options.body instanceof FormData) {
               const entries = [];
               // @ts-ignore - FormData.entries() is valid
               for (const [key, value] of options.body.entries()) {
                   entries.push([key, value]);
               }
               options.body = {
                   __type: 'FormData',
                   entries: entries
               };
           }
           
           // 发送请求代理指令给 Offscreen
           notify({ type: 'FETCH_REQUEST', requestId, url, options, taskId: id });
       });
    };

    const ctx = {
        fetch: proxyFetch
    };

    // 解析并执行用户脚本
    // 假设脚本内容是一个返回异步函数的代码块
    console.log('[Sandbox] Evaluating script');
    const factory = new Function(script);
    const handler = factory();
    
    if (typeof handler !== 'function') {
        throw new Error('Plugin script must return a function');
    }

    // 执行处理函数
    console.log('[Sandbox] Executing handler');
    const result = await handler(inputs, file, ctx);
    console.log('[Sandbox] Handler executed successfully', result);

    // 返回执行结果
    notify({ type: 'EXECUTE_RESULT', id, result });

  } catch (err: any) {
    console.error('[Sandbox] Execution error:', err);
    notify({ type: 'EXECUTE_RESULT', id, error: err.message });
  }
});

// 初始化完成，发送就绪信号
notify({ type: 'SANDBOX_READY' });
