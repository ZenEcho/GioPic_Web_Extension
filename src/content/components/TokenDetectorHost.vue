<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSwitch,
  useMessage,
} from 'naive-ui'
import type { SelectMixedOption } from 'naive-ui/es/select/src/interface'
import browser from 'webextension-polyfill'
import type { DetectorActionFieldSchema, DriveConfig, DriveType, SiteDetectorPlugin } from '@/types'
import { dismissSiteDetectorForPage, ignoreSiteDetectorHost } from '@/content/services/siteDetectorStorage'
import {
  executeSiteDetectorExtract,
  findBestSiteDetector,
  type SiteDetectorMatchCandidate,
} from '@/content/services/siteDetectorRunner'

const { t } = useI18n()
const message = useMessage()

const currentMatch = ref<SiteDetectorMatchCandidate | null>(null)
const actionModel = ref<Record<string, any>>({})
const isExtracting = ref(false)
let domObserver: MutationObserver | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let removeLocationListeners: (() => void) | null = null
let runtimeMessageListener: ((message: any) => void) | null = null

const activePlugin = computed<SiteDetectorPlugin | null>(() => currentMatch.value?.plugin || null)
const presentation = computed(() => currentMatch.value?.presentation || {})
const showDetector = computed(() => Boolean(currentMatch.value))

function getCurrentDomain(): string {
  return window.location.hostname
}

function getInputType(field: DetectorActionFieldSchema): 'text' | 'password' | 'textarea' {
  if (field.type === 'password') {
    return 'password'
  }

  if (field.type === 'textarea') {
    return 'textarea'
  }

  return 'text'
}

function getSelectOptions(field: DetectorActionFieldSchema): SelectMixedOption[] {
  return (field.options || []).map(option => ({
    label: option.label,
    value: option.value,
  }))
}

function buildDefaultModel(plugin: SiteDetectorPlugin | null): Record<string, any> {
  if (!plugin?.detector.actionForm?.length) {
    return {}
  }

  return plugin.detector.actionForm.reduce<Record<string, any>>((model, field) => {
    if (field.default !== undefined) {
      model[field.name] = field.default
    } else if (field.multiple) {
      model[field.name] = []
    } else if (field.type === 'checkbox' || field.type === 'switch') {
      model[field.name] = false
    } else {
      model[field.name] = ''
    }
    return model
  }, {})
}

async function saveConfig(type: DriveType, extra: Partial<DriveConfig> = {}) {
  let config: Partial<DriveConfig>

  if (type === 'custom') {
    config = {
      name: getCurrentDomain(),
      type: 'custom',
      enabled: true,
      ...extra,
    }
  } else {
    config = {
      name: getCurrentDomain(),
      type,
      enabled: true,
      apiUrl: window.location.origin,
      ...extra,
    }
  }

  await browser.runtime.sendMessage({
    type: 'ADD_CONFIG',
    payload: config,
  })

  try {
    await browser.runtime.sendMessage({ type: 'REFRESH_CONFIG' })
  } catch (error) {
    console.warn('Failed to send REFRESH_CONFIG', error)
  }
}

async function evaluateDetector() {
  currentMatch.value = await findBestSiteDetector()
}

function scheduleEvaluate(delay = 250) {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    void evaluateDetector()
  }, delay)
}

function dismissCurrentPrompt() {
  if (!currentMatch.value) {
    return
  }

  dismissSiteDetectorForPage(currentMatch.value.plugin.id, window.location.href)
  currentMatch.value = null
}

async function ignoreCurrentSite() {
  if (!currentMatch.value) {
    return
  }

  await ignoreSiteDetectorHost(currentMatch.value.plugin.id, window.location.hostname)
  currentMatch.value = null
}

async function handleAdd() {
  if (!currentMatch.value || !activePlugin.value) {
    return
  }

  isExtracting.value = true
  try {
    const result = await executeSiteDetectorExtract(
      activePlugin.value,
      { ...actionModel.value },
      { ...currentMatch.value.state },
    )

    const config = result && typeof result === 'object' && 'config' in result
      ? result.config
      : result

    await saveConfig(activePlugin.value.detector.targetDriveType as DriveType, config || {})
    message.success(result?.successText || presentation.value.successText || t('detector.addSuccess'))
    dismissCurrentPrompt()
  } catch (error: any) {
    message.error(error?.message || presentation.value.failureText || t('detector.failed'))
  } finally {
    isExtracting.value = false
  }
}

function updateFieldValue(field: DetectorActionFieldSchema, value: any) {
  actionModel.value = {
    ...actionModel.value,
    [field.name]: value,
  }
}

function setupLocationWatcher() {
  const pushState = history.pushState
  const replaceState = history.replaceState
  const onLocationChange = () => scheduleEvaluate(80)

  history.pushState = function (...args) {
    const result = pushState.apply(this, args as any)
    onLocationChange()
    return result
  }

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args as any)
    onLocationChange()
    return result
  }

  window.addEventListener('popstate', onLocationChange)
  window.addEventListener('hashchange', onLocationChange)

  return () => {
    history.pushState = pushState
    history.replaceState = replaceState
    window.removeEventListener('popstate', onLocationChange)
    window.removeEventListener('hashchange', onLocationChange)
  }
}

function startDomObserver() {
  if (domObserver) {
    domObserver.disconnect()
  }

  domObserver = new MutationObserver(() => {
    scheduleEvaluate(350)
  })

  if (document.body) {
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }
}

watch(activePlugin, (plugin) => {
  actionModel.value = buildDefaultModel(plugin)
}, { immediate: true })

onMounted(() => {
  const start = () => {
    startDomObserver()
    scheduleEvaluate(0)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }

  removeLocationListeners = setupLocationWatcher()

  runtimeMessageListener = (message: any) => {
    if (message.type === 'REFRESH_PLUGINS') {
      scheduleEvaluate(0)
    }
  }
  browser.runtime.onMessage.addListener(runtimeMessageListener)
})

onUnmounted(() => {
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  removeLocationListeners?.()
  if (runtimeMessageListener) {
    browser.runtime.onMessage.removeListener(runtimeMessageListener)
  }
})
</script>

<template>
  <div v-if="showDetector && activePlugin" class="giopic-detector-container">
    <NCard
      :title="presentation.title || activePlugin.name"
      closable
      size="small"
      class="detector-card"
      :bordered="false"
      @close="dismissCurrentPrompt"
    >
      <div class="content">
        <p v-if="presentation.description" class="detector-description">
          {{ presentation.description }}
        </p>

        <NForm v-if="activePlugin.detector.actionForm?.length" label-placement="top" size="small" class="detector-form">
          <NFormItem
            v-for="field in activePlugin.detector.actionForm"
            :key="field.name"
            :label="field.label"
            :show-feedback="false"
            class="detector-form-item"
          >
            <NInput
              v-if="field.type === 'text' || field.type === 'password' || field.type === 'number' || field.type === 'textarea'"
              :type="getInputType(field)"
              :value="String(actionModel[field.name] ?? '')"
              :placeholder="field.placeholder || ''"
              :autosize="field.type === 'textarea' ? { minRows: 3, maxRows: 5 } : undefined"
              @update:value="(value: string) => updateFieldValue(field, field.type === 'number' ? Number(value) : value)"
            />
            <NSelect
              v-else-if="field.type === 'select'"
              :value="actionModel[field.name]"
              :options="getSelectOptions(field)"
              :placeholder="field.placeholder || ''"
              :clearable="field.clearable"
              :filterable="field.filterable"
              :multiple="field.multiple"
              @update:value="(value: any) => updateFieldValue(field, value)"
            />
            <NSwitch
              v-else-if="field.type === 'switch'"
              :value="Boolean(actionModel[field.name])"
              @update:value="(value: boolean) => updateFieldValue(field, value)"
            />
            <NCheckbox
              v-else-if="field.type === 'checkbox'"
              :checked="Boolean(actionModel[field.name])"
              @update:checked="(value: boolean) => updateFieldValue(field, value)"
            >
              {{ field.help || field.label }}
            </NCheckbox>
            <span v-if="field.help && field.type !== 'checkbox'" class="field-help">{{ field.help }}</span>
          </NFormItem>
        </NForm>

        <NSpace justify="end" :size="12" style="margin-top: 16px;">
          <NButton size="small" secondary @click="ignoreCurrentSite">
            {{ presentation.ignoreText || t('detector.ignore') }}
          </NButton>
          <NButton type="primary" size="small" :loading="isExtracting" @click="handleAdd">
            {{ presentation.actionText || t('detector.addToApp', { appName: t('app.name') }) }}
          </NButton>
        </NSpace>
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
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
  width: 360px;
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 12px 24px rgba(0, 0, 0, 0.12);
}

.detector-description {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color);
  opacity: 0.92;
  white-space: pre-wrap;
}

.detector-form {
  margin-top: 12px;
}

.detector-form-item {
  margin-bottom: 12px;
}

.field-help {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

:deep(.n-card-header) {
  padding-bottom: 12px !important;
}

:deep(.n-card__content) {
  padding-top: 4px !important;
}
</style>
