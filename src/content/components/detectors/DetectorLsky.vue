<!--
 * @file DetectorLsky.vue
 * @description Lsky Pro (兰空图床) 自动配置组件
 * 
 * 职责：
 * 1. 引导用户添加 Lsky Pro 图床配置 (v1 或 v2 版本)
 * 2. 尝试从页面获取现有 Token
 * 3. 如果获取失败，引导用户授权并拦截 XSRF Token 以自动请求新 Token
-->

<script setup lang="ts">
import { h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, useDialog, useMessage } from 'naive-ui'
import browser from 'webextension-polyfill'
import type { DriveConfig, DriveType } from '@/types'

const props = defineProps<{
  appName: string
  version: 'v1' | 'v2'
  saveConfig: (type: DriveType, extra?: Partial<DriveConfig>) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'ignore'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()

/**
 * 监听 XSRF Token 并自动请求图床 Token
 * 通过监听 Background 转发的请求头来获取 CSRF 防护 Token，
 * 然后使用该 Token 发起创建图床 API Token 的请求。
 */
const listenForXsrfToken = () => {
  const listener = async (request: any) => {
    if (request.XSRF_TOKEN || request.Authorization) {
      browser.runtime.onMessage.removeListener(listener)
      try {
        const isV2 = props.version === 'v2'
        const data = isV2
          ? {
            name: props.appName,
            abilities: [
              'upload:write',
              'basic',
              'user:profile:read',
              'user:token:read',
              'user:capacity:read',
              'user:group:read',
            ],
          }
          : {
            name: props.appName,
            abilities: [
              'user:profile',
              'image:tokens',
              'image:upload',
              'image:list',
              'image:delete',
              'album:list',
              'album:delete',
              'strategy:list',
            ],
          }
        const endpoint = isV2 ? '/api/v2/user/tokens' : '/user/tokens'
        const response = await fetch(window.location.origin + endpoint, {
          headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': request.XSRF_TOKEN,
            'Authorization': request.Authorization,
          },
          body: JSON.stringify(data),
          method: 'POST',
          credentials: 'include',
        })
        const responseData = await response.json()
        if (responseData.data?.token) {
          await props.saveConfig('lsky', {
            apiUrl: window.location.origin,
            token: String(responseData.data.token),
            version: isV2 ? 'v2' : 'v1',
            permission: '0'
          })
          message.success(t('detector.addSuccess'))
          emit('close')
        } else {
          message.error(t('detector.failed'))
        }
      } catch {
        message.error(t('detector.failed'))
      }
    }
  }
  browser.runtime.onMessage.addListener(listener)
}

/**
 * 处理添加配置逻辑
 * 1. 对于 v1 版本，尝试直接从页面 DOM 获取 Token
 * 2. 如果获取失败或为 v2 版本，弹出权限请求对话框，引导用户刷新页面以捕获 XSRF Token
 */
const handleAdd = async () => {
  try {
    if (props.version === 'v1') {
      const tokenEl = document.querySelector('#token-create-success p:nth-child(2)')
      const token = tokenEl?.textContent?.trim()
      if (token) {
        await props.saveConfig('lsky', {
          apiUrl: window.location.origin,
          token,
          version: 'v1',
          permission: '0',
        })
        message.success(t('detector.addSuccess'))
        emit('close')
      } else {
        message.warning(t('detector.getTokenFailed'))
        dialog.warning({
          title: t('detector.permissionTitle'),
          content: () =>
            h('div', { style: 'white-space: pre-wrap' }, [
              h('div', t('detector.permissionContentLine1', { appName: props.appName })),
              h('div', t('detector.permissionContentLine2')),
            ]),
          positiveText: t('detector.allowAndGet'),
          positiveButtonProps: {
            type: 'default'
          },
          negativeText: t('detector.reject'),
          onPositiveClick: () => {
            browser.runtime.sendMessage({ getXsrfToken: 'getXsrfToken', url: window.location.href })
            listenForXsrfToken()
          },
        })
      }
    } else {
      dialog.warning({
        title: t('detector.permissionTitle'),
        content: () =>
          h('div', { style: 'white-space: pre-wrap' }, [
            h('div', t('detector.permissionContentLine1', { appName: props.appName })),
            h('div', t('detector.permissionContentLine2')),
          ]),
        positiveText: t('detector.allowAndGet'),
        positiveButtonProps: {
          type: 'default'
        },
        negativeText: t('detector.reject'),
        onPositiveClick: () => {
          browser.runtime.sendMessage({ getXsrfToken: 'getXsrfToken', url: window.location.href })
          listenForXsrfToken()
        },
      })
    }
  } catch {
    message.error(t('detector.failed'))
  }
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
