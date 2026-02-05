/**
 * @file variables.ts
 * @description 变量替换工具函数
 * 
 * 职责：
 * 1. 处理文件上传配置中的魔术变量替换
 * 2. 支持时间 ({year}, {month}...), 文件名 ({filename}), UUID 等变量
 * 3. 批量替换配置对象中的变量
 * 
 * 依赖：
 * - uuid: 生成 UUID
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * 替换字符串中的魔术变量
 * 
 * 支持的变量：
 * - {filename}: 原文件名 (包含扩展名)
 * - {name}: 文件名 (不含扩展名)
 * - {ext}: 扩展名 (包含点)
 * - {year}: 4位年份
 * - {month}: 2位月份
 * - {day}: 2位日期
 * - {timestamp}: 时间戳
 * - {random}: 8位随机字符串
 * - {uuid}: v4 UUID
 * 
 * @param template - 包含变量的模板字符串
 * @param file - 上传的文件对象
 * @returns 替换后的字符串
 */
export function replaceMagicVariables(template: string, file: File): string {
    if (!template) return template
    
    const now = new Date()
    const filename = file.name
    const ext = filename.lastIndexOf('.') > -1 ? filename.slice(filename.lastIndexOf('.')) : ''
    const name = filename.lastIndexOf('.') > -1 ? filename.slice(0, filename.lastIndexOf('.')) : filename
    
    // YYYY, MM, DD
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const timestamp = now.getTime().toString()
    
    // Random string (simple implementation)
    const random = Math.random().toString(36).substring(2, 10)
    const uuid = uuidv4()

    return template
        .replace(/{filename}/g, filename)
        .replace(/{name}/g, name)
        .replace(/{ext}/g, ext)
        .replace(/{year}/g, year)
        .replace(/{month}/g, month)
        .replace(/{day}/g, day)
        .replace(/{timestamp}/g, timestamp)
        .replace(/{random}/g, random)
        .replace(/{uuid}/g, uuid)
}

/**
 * 替换配置对象中的所有变量
 * 遍历配置的所有 Value 并执行变量替换
 * 
 * @param config - 原始配置对象
 * @param file - 上传的文件对象
 * @returns 替换后的新配置对象
 */
export function replaceVariablesInConfig(config: Record<string, string>, file: File): Record<string, string> {
    const newConfig: Record<string, string> = {}
    for (const [key, value] of Object.entries(config)) {
        newConfig[key] = replaceMagicVariables(value, file)
    }
    return newConfig
}
