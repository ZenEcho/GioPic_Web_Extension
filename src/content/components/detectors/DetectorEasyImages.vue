<script setup lang="ts">
import { ref } from 'vue'
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
const isProcessing = ref(false)

const handleAdd = async () => {
  isProcessing.value = true
  try {
    const params = new URLSearchParams()
    const token = crypto.randomUUID().replace(/-/g, '')
    params.append('add_token', token)
    params.append('add_token_expired', '1314')
    params.append('add_token_id', Date.now().toString())
    const response = await fetch(window.location.href, {
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params,
      method: 'POST',
    })
    if (response.status === 200) {
      await props.saveConfig('easyimages', {
        apiUrl: window.location.origin,
        token,
      })
      message.success(t('detector.addSuccess'))
      emit('close')
    } else {
      message.error(t('detector.failed'))
    }
  } catch {
    message.error(t('detector.failed'))
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="info-text">
    <p>{{ t('detector.foundTitle', { appName }) }}</p>
  </div>
  <NSpace justify="end" :size="12" style="margin-top: 16px;">
    <NButton size="small" secondary @click="emit('ignore')">{{ t('detector.ignore') }}</NButton>
    <NButton type="primary" size="small" :loading="isProcessing" @click="handleAdd">
      {{ t('detector.addToApp', { appName }) }}
    </NButton>
  </NSpace>
</template>
