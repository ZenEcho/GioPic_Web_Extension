<!--
 * @file DetectorChevereto.vue
 * @description Chevereto 图床自动配置组件
 * 
 * 职责：
 * 1. 引导用户添加 Chevereto 图床配置
 * 2. 尝试从页面 DOM (#api_v1_key) 获取 API Key
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, useMessage } from 'naive-ui'
import type { DriveConfig, DriveType } from '@/types'

const props = defineProps<{
  appName: string
  saveConfig: (type: DriveType, extra?: Partial<DriveConfig>) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'ignore'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const message = useMessage()

/**
 * 添加配置
 * 尝试从页面元素获取 API Key 并保存配置
 */
const handleAdd = async () => {
  const apiKey = (document.querySelector('#api_v1_key') as HTMLInputElement)?.value
  if (!apiKey) {
    message.error(t('detector.failed'))
    return
  }
  await props.saveConfig('chevereto', {
    apiUrl: window.location.origin,
    token: apiKey,
    expiration: 'NONE',
    nsfw: '0',
  })
  message.success(t('detector.addSuccess'))
  emit('close')
}
</script>

<template>
  <div class="info-text">
    <p>{{ t('detector.lskyContent', { appName }) }}</p>
  </div>
  <NSpace justify="end" :size="12" style="margin-top: 16px;">
    <NButton size="small" secondary @click="emit('ignore')">{{ t('detector.ignore') }}</NButton>
    <NButton type="primary" size="small" @click="handleAdd">
      {{ t('detector.addToApp', { appName }) }}
    </NButton>
  </NSpace>
</template>
