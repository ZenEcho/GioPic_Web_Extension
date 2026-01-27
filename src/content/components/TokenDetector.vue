<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard } from 'naive-ui'
import browser from 'webextension-polyfill'
import type { WebUploaderConfig, CustomConfig, DriveConfig, DriveType } from '@/types'
import { detectSite } from '@/content/services/driveDetector'
import type { DetectorType } from '@/content/services/driveDetector'
import DetectorLsky from '@/content/components/detectors/DetectorLsky.vue'
import DetectorLskyOpen from '@/content/components/detectors/DetectorLskyOpen.vue'
import DetectorEasyImages from '@/content/components/detectors/DetectorEasyImages.vue'
import DetectorChevereto from '@/content/components/detectors/DetectorChevereto.vue'
import Detector16best from '@/content/components/detectors/Detector16best.vue'
import DetectorCloudFlareImg from '@/content/components/detectors/DetectorCloudFlareImg.vue'
import DetectorTelegraphImg from '@/content/components/detectors/DetectorTelegraphImg.vue'

const { t } = useI18n()

const showDetector = ref(false)
const detectorType = ref<DetectorType | null>(null)
const lskyVersion = ref<'v1' | 'v2'>('v1')
let observer: MutationObserver | null = null
let urlInterval: ReturnType<typeof setInterval> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const getCurrentDomain = () => window.location.hostname

const ignoreSite = () => {
  localStorage.setItem(getCurrentDomain(), 'true')
  showDetector.value = false
  stopObserver() // 用户手动忽略后，停止后续检测
}

const closeDetector = () => {
  showDetector.value = false
  // 用户关闭后，暂时停止检测，直到页面刷新或 URL 变化
  stopObserver()
}

const checkSite = async () => {
  // 如果已经显示探测器，不再重复检测
  if (showDetector.value) {
    stopObserver()
    return true
  }

  const result = await detectSite()
  // console.log(result);
  
  if (result) {
    detectorType.value = result.type
    if (result.version) {
      lskyVersion.value = result.version
    }
    showDetector.value = true
    stopObserver() // 检测成功后，停止监听 DOM 变化以节省性能
    return true
  }
  return false
}

// 停止 DOM 监听
const stopObserver = () => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// 启动 DOM 监听
const startObserver = () => {
  // 先清理旧的
  stopObserver()
  
  // 立即执行一次检查
  void checkSite()

  // 创建新的 Observer
  observer = new MutationObserver(() => {
    // 防抖处理：避免 DOM 频繁变动导致频繁 check
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void checkSite()
    }, 500)
  })

  // 监听整个文档树的变化
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

async function saveConfig(type: DriveType = 'lsky', extra: Partial<DriveConfig> = {}) {
  let cfg: Partial<DriveConfig> = {}

  if (type === 'custom') {
    cfg = {
      name: getCurrentDomain(),
      type: 'custom',
      enabled: true,
      ...extra
    } as Partial<CustomConfig>
  } else {
    cfg = {
      name: getCurrentDomain(),
      type: type as WebUploaderConfig['type'],
      enabled: true,
      apiUrl: window.location.origin,
      ...extra
    } as Partial<WebUploaderConfig>
  }

  await browser.runtime.sendMessage({
    type: 'ADD_CONFIG',
    payload: cfg,
  })

  // Notify other parts to refresh
  try {
    await browser.runtime.sendMessage({ type: 'REFRESH_CONFIG' })
  } catch (e) {
    console.warn('Failed to send REFRESH_CONFIG', e)
  }
}

onMounted(() => {
  // 1. 初始启动监听
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true })
  } else {
    startObserver()
  }

  // 2. 监听 URL 变化 (SPA 路由支持)
  let lastPath = window.location.pathname
  urlInterval = setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      // URL 变化意味着进入了新页面/路由，重置状态并重启 DOM 监听
      // 注意：这里不重置 showDetector.value 为 false，除非你想在每个页面都重新探测
      // 通常如果已经在当前域探测到了，可能不需要再次探测？
      // 但如果是不同子路径对应不同图床（较少见），或者用户之前关闭了探测器
      // 这里保守策略：如果当前没显示，就重新开始监听
      if (!showDetector.value) {
        startObserver()
      }
    }
  }, 1000)
})

onUnmounted(() => {
  stopObserver()
  if (urlInterval) clearInterval(urlInterval)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div v-if="showDetector" class="giopic-detector-container">
    <NCard :title="t('detector.foundTitle', { appName: t('app.name') })" closable @close="showDetector = false"
      size="small" class="detector-card" :bordered="false">
      <div class="content">
        <DetectorLsky
          v-if="detectorType === 'lsky'"
          :appName="t('app.name')"
          :version="lskyVersion"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <DetectorLskyOpen
          v-if="detectorType === 'lskyOpen'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <DetectorEasyImages
          v-if="detectorType === 'easyimages'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <DetectorChevereto
          v-if="detectorType === 'chevereto'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <Detector16best
          v-if="detectorType === '16best'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <DetectorCloudFlareImg
          v-if="detectorType === 'cloudflareImg'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
        <DetectorTelegraphImg
          v-if="detectorType === 'telegraphImg'"
          :appName="t('app.name')"
          :saveConfig="saveConfig"
          @ignore="ignoreSite"
          @close="closeDetector"
        />
      </div>
    </NCard>

  </div>
</template>
<style scoped>
.giopic-detector-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483640;
  /* High z-index */
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.detector-card {
  width: 340px;
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 12px 24px rgba(0, 0, 0, 0.12);
}

:deep(.info-text p) {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color);
  opacity: 0.9;
}


:deep(.n-card-header) {
  padding-bottom: 12px !important;
}

:deep(.n-card__content) {
  padding-top: 4px !important;
}

/* Dialog positive (default type) button hover: text to white */
:deep(.n-dialog .n-button.n-button--default:hover .n-button__content) {
  color: #fff !important;
}
</style>
