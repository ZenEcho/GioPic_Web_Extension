/**
 * @file nodeUtil.ts
 * @description Node.js 'util' 模块的浏览器端 Polyfill
 * 
 * 职责：
 * 1. 提供 Node.js 环境下 `util` 模块的部分 API 实现
 * 2. 解决部分第三方 SDK (如 ali-oss, aws-sdk) 在浏览器环境运行时的依赖缺失问题
 * 3. 通过 vite.config.ts 别名映射替换原生 `util` 包，减小 bundle 体积
 */

/**
 * 标记函数弃用（Polyfill 实现，仅返回原函数）
 * 
 * @param fn - 目标函数
 * @param _msg - 弃用消息（被忽略）
 * @returns 原函数
 */
export function deprecate<T extends (...args: any[]) => any>(fn: T, _msg: string): T {
  return fn
}

/**
 * 调试日志函数（Polyfill 实现，返回空函数）
 * 
 * @param _set - 调试集名称
 * @returns 空操作函数
 */
export function debuglog(_set: string) {
  return () => {}
}

/**
 * 原型继承实现
 * 兼容 Object.setPrototypeOf 和 Object.create
 * 
 * @param ctor - 子类构造函数
 * @param superCtor - 父类构造函数
 */
export function inherits(ctor: any, superCtor: any) {
  if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
  } else {
    const proto = Object.create(superCtor.prototype)
    Object.assign(proto, ctor.prototype)
    ctor.prototype = proto
  }
  ;(ctor as any).super_ = superCtor
}

const util = {
  deprecate,
  debuglog,
  inherits,
}

export default util
