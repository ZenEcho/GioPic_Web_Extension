<template>
  <div class="giopic-overlay-container">
    <!-- 侧边栏 (包含悬浮球) -->
    <WebSidebar />
    
    <!-- 上传列表 (右下角) -->
    <UploadList />
    
    <!-- Token 检测器 (不可见，但可能弹窗) -->
    <TokenDetector />
    
    <!-- 链接预览 (悬浮) -->
    <LinkPreview />

    <!-- 全局通知占位符 (由 NNotificationProvider 管理) -->
    <NotificationView />
  </div>
</template>

<script setup lang="ts">
import WebSidebar from './WebSidebar.vue'
import UploadList from './UploadList.vue'
import TokenDetector from './TokenDetector.vue'
import NotificationView from './NotificationView.vue'
import LinkPreview from './LinkPreview.vue'
</script>

<style scoped>
.giopic-overlay-container {
  pointer-events: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2147483647;
}

:deep(.giopic-detector-container),
:deep(.giopic-floating-ball),
:deep(.giopic-dialog-overlay),
:deep(.giopic-web-overlay),
:deep(.giopic-preview-dialog-overlay),
:deep(iframe) {
  pointer-events: auto;
}
</style>
