/**
 * @file useUploadInput.ts
 * @description 上传输入交互组合式函数
 * 
 * 职责：
 * 1. 处理文件拖拽（Drop）事件
 * 2. 处理全局粘贴（Paste）事件
 * 3. 提取文件对象并回调
 * 
 * 依赖：
 * - vue: 生命周期钩子
 */

import { onMounted, onUnmounted } from 'vue'

/**
 * 上传输入处理的组合式函数
 * 处理文件拖拽和粘贴上传事件
 * 
 * @param onFiles - 接收文件列表的回调函数
 */
export function useUploadInput(onFiles: (files: File[]) => void) {
    /**
     * 处理文件拖拽释放事件
     * 
     * @param files - 拖拽的文件列表对象
     */
    function onFilesDropped(files: FileList | File[]) {
        const fileList: File[] = []
        if (Array.isArray(files)) {
            files.forEach(file => {
                if (file) fileList.push(file)
            })
        } else {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                if (file) fileList.push(file)
            }
        }
        if (fileList.length) onFiles(fileList)
    }

    /**
     * 处理粘贴事件
     * 从剪贴板中提取图片文件
     * 
     * @param event - 剪贴板事件
     */
    function handlePaste(event: ClipboardEvent) {
        const items = event.clipboardData?.items
        if (!items) return

        const fileList: File[] = []
        for (let i = 0; i < items.length; i++) {
            if (items[i]?.type?.indexOf('image') !== -1) {
                const file = items[i]?.getAsFile?.()
                if (file) fileList.push(file)
            }
        }
        if (fileList.length) onFiles(fileList)
    }
    
    // 挂载时添加全局粘贴监听
    onMounted(() => {
        document.addEventListener('paste', handlePaste)
    })
    
    // 卸载时移除监听
    onUnmounted(() => {
        document.removeEventListener('paste', handlePaste)
    })

    return {
        onFilesDropped
    }
}
