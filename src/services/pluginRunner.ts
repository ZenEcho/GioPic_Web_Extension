/**
 * Plugin Runner (插件调度器)
 * 
 * 角色: Scheduler (调度器)
 * 职责:
 * 1. 生命周期管理: 负责创建和销毁 Offscreen Document。
 * 2. 健康检查: 通过 PING/PONG 机制检测 Offscreen 环境是否就绪。
 * 3. 任务分发: 将用户上传操作封装为 EXECUTE_PLUGIN 消息，发送给 Offscreen。
 * 4. 事件驱动: 使用 taskId 跟踪异步任务，监听执行结果和进度事件。
 * 
 * 对应架构文档: plugins/plugin_architecture.md # Plugin Runner
 */

import { db } from '@/utils/storage'
import type { PluginDriveConfig, PluginMeta } from '@/types'
import browser from 'webextension-polyfill'

// 辅助函数：将 File 对象转换为 Base64 字符串
// 用于跨进程传递文件数据（Chrome 消息传递不支持直接传输 File 对象）
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 全局任务映射表
// Key: TaskID
// Value: Promise 的 resolve/reject 函数以及进度回调
const pendingTasks = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void, onProgress?: (p: number) => void }>();

// 监听来自 Offscreen 的消息结果
// Offscreen 完成任务后会通过 runtime.sendMessage 发回结果
// @ts-ignore
if (typeof chrome !== 'undefined' && chrome.runtime) {
    // @ts-ignore
    chrome.runtime.onMessage.addListener((msg: any) => {
        if (msg.taskId) {
            const task = pendingTasks.get(msg.taskId);
            if (task) {
                // 处理插件执行结果 (PLUGIN_EXECUTION_RESULT)
                if (msg.type === 'PLUGIN_EXECUTION_RESULT') {
                    console.log('[PluginRunner] Received result for task', msg.taskId, msg);
                    if (msg.success) {
                        task.resolve(msg.result);
                    } else {
                        task.reject(new Error(msg.error || 'Plugin execution failed'));
                    }
                    // 任务完成，清理映射
                    pendingTasks.delete(msg.taskId);
                } 
                // 处理上传进度 (PLUGIN_PROGRESS)
                else if (msg.type === 'PLUGIN_PROGRESS') {
                    if (task.onProgress) {
                        task.onProgress(msg.percent);
                    }
                }
            }
        }
    });
}

/**
 * 执行插件上传逻辑
 * @param config 插件图床配置
 * @param file 要上传的文件
 * @param onProgress 上传进度回调
 * @returns 上传成功后的图片 URL
 */
export async function runPlugin(config: PluginDriveConfig, file: File, onProgress?: (progress: number) => void): Promise<string> {
  // 直接从 Storage 读取插件列表，以支持 Background Service Worker 环境 (无 Pinia 实例)
  const plugins = await db.get<PluginMeta[]>('plugins') || [];
  const plugin = plugins.find(p => p.id === config.type && p.enabled !== false);
  
  if (!plugin) {
    throw new Error(`Plugin ${config.type} not found`);
  }

  // 1. 确保 Offscreen Document 存在 (作为沙箱的中转站)
  // @ts-ignore
  if (typeof browser !== 'undefined' && browser.offscreen) {
    try {
        // @ts-ignore
        const hasDoc = await browser.offscreen.hasDocument();
        if (!hasDoc) {
             // 创建 Offscreen Document
             // @ts-ignore
             await browser.offscreen.createDocument({
                url: 'src/offscreen/offscreen.html',
                reasons: ['DOM_PARSER' as any], 
                justification: 'Execute Plugin Sandbox'
             });
        }
        
        // 2. 健康检查 (PING) - 等待 Offscreen 就绪
        // 最多重试 50 次 (约 5 秒)
        let ready = false;
        let lastError = '';
        for(let i=0; i<50; i++) {
            try {
                const pong = await browser.runtime.sendMessage({ type: 'PING' }).catch((err: any) => {
                    lastError = err.message;
                    return null;
                });

                if (pong === 'PONG') {
                    ready = true;
                    break;
                }
            } catch(e: any) {
                lastError = e.message;
            }
            // 等待 100ms 后重试
            await new Promise(r => setTimeout(r, 100));
        }
        
        // 如果 Offscreen 无响应，尝试重启它
        if (!ready) {
             console.warn('Offscreen did not respond to PING, closing and recreating...', lastError);
             try {
                 // @ts-ignore
                 await browser.offscreen.closeDocument();       
             } catch(e) { /* ignore */ }
             
             // @ts-ignore
             await browser.offscreen.createDocument({
                url: 'src/offscreen/offscreen.html',
                reasons: ['DOM_PARSER' as any], 
                justification: 'Execute Plugin Sandbox'
             });
             
             // 重启后短暂等待
             await new Promise(r => setTimeout(r, 500));
        }

    } catch (e: any) {
        if (!e.message?.includes('Only a single offscreen document')) {
             console.warn('Offscreen creation warning:', e);
        }
    }
  }

  // 3. 准备任务数据
  const base64 = await fileToBase64(file);
  const taskId = Math.random().toString(36).substring(7);

  return new Promise((resolve, reject) => {
      // 注册任务到 pendingTasks
      pendingTasks.set(taskId, { resolve, reject, onProgress });
      
      // 4. 设置安全超时 (30秒)
      // 防止恶意脚本死循环导致扩展卡死
      setTimeout(() => {
          if (pendingTasks.has(taskId)) {
              pendingTasks.delete(taskId);
              reject(new Error('Plugin execution timed out (30s)'));
          }
      }, 30000);

      console.log('[PluginRunner] Sending EXECUTE_PLUGIN message to Offscreen, taskId:', taskId);
      
      // 5. 发送 EXECUTE_PLUGIN 消息给 Offscreen
      // Offscreen 收到后会转发给 Sandbox iframe
      // @ts-ignore
      chrome.runtime.sendMessage({
          type: 'EXECUTE_PLUGIN',
          id: taskId,
          script: plugin.script,
          inputs: config,
          file: {
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64
          }
      }, (response: any) => {
           // 检查消息发送是否立即失败
           // @ts-ignore
           if (chrome.runtime.lastError) {
               // @ts-ignore
               console.error('[PluginRunner] Send message error:', chrome.runtime.lastError);
               pendingTasks.delete(taskId);
               // @ts-ignore
               reject(new Error(chrome.runtime.lastError.message));
           }
      });
  });
}
