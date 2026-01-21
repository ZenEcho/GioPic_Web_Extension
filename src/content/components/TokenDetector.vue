<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const { t } = useI18n()

const showDetector = ref(false)
const detectorType = ref<DetectorType | null>(null)
const lskyVersion = ref<'v1' | 'v2'>('v1')

const getCurrentDomain = () => window.location.hostname

const ignoreSite = () => {
  localStorage.setItem(getCurrentDomain(), 'true')
  showDetector.value = false
}

const closeDetector = () => {
  showDetector.value = false
}

const checkSite = async () => {
  const result = await detectSite()
  if (result) {
    detectorType.value = result.type
    if (result.version) {
      lskyVersion.value = result.version
    }
    showDetector.value = true
  }
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void checkSite() }, { once: true })
  } else {
    void checkSite()
  }
  let lastPath = window.location.pathname
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname
      void checkSite()
    }
  }, 1000)
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
