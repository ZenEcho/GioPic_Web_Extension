/**
 * @file polyfill.ts
 * @description 浏览器环境 Polyfill
 * 
 * 职责：
 * 1. 确保 `window` 对象在 Service Worker 环境中可用（部分库依赖 window 全局变量）
 */

if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
    (self as any).window = self;
}
