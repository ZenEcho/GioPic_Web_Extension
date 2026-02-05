<!--
 * @file NotificationView.vue
 * @description 全局通知组件视图
 * 
 * 职责：
 * 1. 接收来自 Background 的通知消息
 * 2. 使用 Naive UI 的 useNotification 显示通知
 * 3. 作为一个无 UI 的功能组件存在（Template 为空）
-->

<script setup lang="ts">
import { useNotification } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
import browser from 'webextension-polyfill'

const notification = useNotification()

/**
 * 处理消息
 * 监听 SHOW_TOAST 类型的消息并显示通知
 * 
 * @param message - 消息对象
 */
const handleMessage = (message: any) => {
  if (message.type === 'SHOW_TOAST') {
    const { title, message: content, type = 'info', duration = 3000 } = message.data
    
    // Map types to Naive UI notification types
    const nType = (['info', 'success', 'warning', 'error'].includes(type) ? type : 'info') as 'info' | 'success' | 'warning' | 'error'
    
    notification[nType]({
      title: title,
      content: content,
      duration: duration,
      keepAliveOnHover: true,
      closable: true
    })
  }
}

onMounted(() => {
  browser.runtime.onMessage.addListener(handleMessage)
})

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(handleMessage)
})
</script>

<template>
  <div style="display: none;"></div>
</template>
