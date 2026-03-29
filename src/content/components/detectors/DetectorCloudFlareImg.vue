<!--
 * @file DetectorCloudFlareImg.vue
 * @description CloudFlare Images (开源项目) 自动配置组件
 * @deprecated 已迁移到 kind: 'site-detector' 插件实现，仅保留作历史参考
 * 
 * 职责：
 * 1. 引导用户添加 CloudFlare Images 图床配置
 * 2. 自动生成适配该项目的自定义图床配置参数
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
 * 预设适用于 CloudFlare-ImgBed 开源项目的 API 参数
 */
const handleAdd = async () => {
  try {
    
    await props.saveConfig('custom', {
      apiUrl: window.location.origin+'/upload',
      method: 'POST',
      uploadFormat: 'formData',
      fileParamName: 'file',
      responseUrlPath: '[0].src',
      urlPrefix: window.location.origin,
    })
    message.success(t('detector.addSuccess'))
    emit('close')

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

