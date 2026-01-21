<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NInput, NForm, NFormItem, useMessage } from 'naive-ui'
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
const email = ref('')
const password = ref('')
const isProcessing = ref(false)

const handleSubmit = async () => {
  if (!email.value || !password.value) {
    message.warning(t('detector.failed'))
    return
  }
  isProcessing.value = true
  try {
    const formData = new FormData()
    formData.append('email', email.value)
    formData.append('password', password.value)
    const response = await fetch(window.location.origin + '/api/v1/tokens', {
      headers: {
        Accept: 'application/json',
      },
      body: formData,
      method: 'POST',
    })
    const data = await response.json()
    if (data?.data?.token) {
      await props.saveConfig('lsky', {
        apiUrl: window.location.origin,
        token: String(data.data.token),
        version: 'v1',
        permission: '0'
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
    <p>{{ t('detector.lskyOpenContent', { appName }) }}</p>
  </div>
  <NForm label-placement="left" label-width="auto" size="small" style="margin-top: 12px;">
    <NFormItem :label="t('detector.email')" :show-feedback="false" style="margin-bottom: 8px;">
      <NInput v-model:value="email" placeholder="" />
    </NFormItem>
    <NFormItem :label="t('detector.password')" :show-feedback="false">
      <NInput type="password" v-model:value="password" placeholder="" />
    </NFormItem>
  </NForm>
  <NSpace justify="end" :size="12" style="margin-top: 16px;">
    <NButton size="small" secondary @click="emit('ignore')">{{ t('detector.ignore') }}</NButton>
    <NButton type="primary" size="small" :loading="isProcessing" @click="handleSubmit">
      {{ t('detector.addToApp', { appName }) }}
    </NButton>
  </NSpace>
</template>
