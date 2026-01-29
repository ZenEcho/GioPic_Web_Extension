<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, useMessage } from 'naive-ui'
import { db } from '@/utils/storage'
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

const handleAdd = async () => {
  try {
    const data = await db.getFromExternal('image-hosting', 'config')
    const tokenItem = data.find((item: any) => item.key === 'token')

    if (tokenItem?.value) {
      await props.saveConfig('custom', {
        apiUrl: 'https://i.111666.best/image',
        method: 'POST',
        uploadFormat: 'formData',
        fileParamName: 'image',
        headers: JSON.stringify({ 'Auth-Token': tokenItem.value }),
        responseUrlPath: 'src',
        urlPrefix: 'https://i.111666.best',
      })
      message.success(t('detector.addSuccess'))
      emit('close')
    } else {
      message.error(t('detector.failed'))
    }
  } catch (error) {
    console.error(error)
    message.error(t('detector.failed'))
  }
}
</script>

<template>
  <div class="info-text">
    <p>{{ t('detector.commonContent', { appName }) }}</p>
  </div>
  <NSpace justify="end" :size="12" style="margin-top: 16px;">
    <NButton size="small" secondary @click="emit('ignore')">{{ t('detector.ignore') }}</NButton>
    <NButton type="primary" size="small" @click="handleAdd">
      {{ t('detector.addToApp', { appName }) }}
    </NButton>
  </NSpace>
</template>
