<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NCard, NButton, NSpace, NInput, useMessage, useDialog, NForm, NFormItem } from 'naive-ui'
import browser from 'webextension-polyfill'
import { db } from '@/utils/storage'
import type { WebUploaderConfig, CustomConfig, DriveConfig, DriveType } from '@/types'
import { detectSite } from '@/content/services/driveDetector'
import type { DetectorType } from '@/content/services/driveDetector'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const showDetector = ref(false)
const detectorType = ref<DetectorType | null>(null)
const lskyVersion = ref<'v1' | 'v2'>('v1')
const email = ref('')
const password = ref('')
const isProcessing = ref(false)

const getCurrentDomain = () => window.location.hostname

const ignoreSite = () => {
  localStorage.setItem(getCurrentDomain(), 'true')
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

const handleAddToAppLsky = async () => {
  try {
    if (lskyVersion.value === 'v1') {
      const tokenEl = document.querySelector('#token-create-success p:nth-child(2)')
      const token = tokenEl?.textContent?.trim()
      if (token) {
        await saveConfig("lsky", {
          apiUrl: window.location.origin,
          token,
          version: 'v1',
          permission: "0",
        })
        message.success(t('detector.addSuccess'))
        showDetector.value = false
      } else {
        message.warning(t('detector.getTokenFailed'))
        dialog.warning({
          title: t('detector.permissionTitle'),
          content: () =>
            h('div', { style: 'white-space: pre-wrap' }, [
              h('div', t('detector.permissionContentLine1', { appName: t('app.name') })),
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
            h('div', t('detector.permissionContentLine1', { appName: t('app.name') })),
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

const listenForXsrfToken = () => {
  const listener = async (request: any) => {
    if (request.XSRF_TOKEN || request.Authorization) {
      browser.runtime.onMessage.removeListener(listener)
      try {
        const isV2 = lskyVersion.value === 'v2'
        const data = isV2
          ? {
            name: t('app.name'),
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
            name: t('app.name'),
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
          await saveConfig("lsky", {
            apiUrl: window.location.origin,
            token: String(responseData.data.token),
            version: isV2 ? 'v2' : 'v1',
            permission: "0"
          })
          message.success(t('detector.addSuccess'))
          showDetector.value = false
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

const handleAddToAppLskyOpen = async () => {
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
      await saveConfig("lsky", {
        apiUrl: window.location.origin,
        token: String(data.data.token),
        version: 'v1',
        permission: "0"
      })
      message.success(t('detector.addSuccess'))
      showDetector.value = false
    } else {
      message.error(t('detector.failed'))
    }
  } catch {
    message.error(t('detector.failed'))
  } finally {
    isProcessing.value = false
  }
}

const handleAddToAppEasyImages = async () => {
  isProcessing.value = true
  try {
    let Params = new URLSearchParams();
    const Token = crypto.randomUUID().replace(/-/g, '');
    Params.append("add_token", Token);
    Params.append("add_token_expired", "1314");
    Params.append("add_token_id", Date.now().toString());
    const response = await fetch(window.location.href, {
      "headers": {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: Params,
      method: 'POST',
    })
    if (response.status === 200) {
      await saveConfig('easyimages', {
        apiUrl: window.location.origin,
        token: Token,
      })
      message.success(t('detector.addSuccess'))
      showDetector.value = false
    } else {
      message.error(t('detector.failed'))
    }
  } catch {
    message.error(t('detector.failed'))
  } finally {
    isProcessing.value = false
  }
}
const handleAddToAppChevereto = async () => {
  // document.querySelector("#api_v1_key")
  const apiKey = (document.querySelector("#api_v1_key") as HTMLInputElement)?.value
  if (!apiKey) {
    message.error(t('detector.failed'))
    return
  }
  await saveConfig('chevereto', {
    apiUrl: window.location.origin,
    token: apiKey,
    expiration: "NONE",
    nsfw: "0",
  })
  message.success(t('detector.addSuccess'))
  showDetector.value = false
}
const handleAddToApp16best = async () => {
  // db读取image-hosting数据库的config
  try {
    const data = await db.getFromExternal('image-hosting', 'config')
    const tokenItem = data.find((item: any) => item.key === 'token')

    if (tokenItem?.value) {
      await saveConfig('custom', {
        apiUrl: 'https://i.111666.best/image',
        method: 'POST',
        uploadFormat: 'formData',
        fileParamName: 'image',
        headers: JSON.stringify({ 'Auth-Token': tokenItem.value }),
        responseUrlPath: 'src',
        urlPrefix: 'https://i.111666.best',
      })
      message.success(t('detector.addSuccess'))
      showDetector.value = false
    } else {
      message.error(t('detector.failed'))
    }
  } catch (error) {
    console.error(error)
    message.error(t('detector.failed'))
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
        <template v-if="detectorType === 'lsky'">
          <div class="info-text">
            <p>{{ t('detector.lskyContent', { appName: t('app.name') }) }}</p>
          </div>
          <NSpace justify="end" :size="12" style="margin-top: 16px;">
            <NButton size="small" secondary @click="ignoreSite">{{ t('detector.ignore') }}</NButton>
            <NButton type="primary" size="small" @click="handleAddToAppLsky">
              {{ t('detector.addToApp', { appName: t('app.name') }) }}
            </NButton>
          </NSpace>
        </template>

        <template v-if="detectorType === 'lskyOpen'">
          <div class="info-text">
            <p>{{ t('detector.lskyOpenContent', { appName: t('app.name') }) }}</p>
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
            <NButton size="small" secondary @click="ignoreSite">{{ t('detector.ignore') }}</NButton>
            <NButton type="primary" size="small" :loading="isProcessing" @click="handleAddToAppLskyOpen">
              {{ t('detector.addToApp', { appName: t('app.name') }) }}
            </NButton>
          </NSpace>
        </template>

        <template v-if="detectorType === 'easyimages'">
          <div class="info-text">
            <p>{{ t('detector.foundTitle', { appName: t('app.name') }) }}</p>
          </div>
          <NSpace justify="end" :size="12" style="margin-top: 16px;">
            <NButton size="small" secondary @click="ignoreSite">{{ t('detector.ignore') }}</NButton>
            <NButton type="primary" size="small" :loading="isProcessing" @click="handleAddToAppEasyImages">
              {{ t('detector.addToApp', { appName: t('app.name') }) }}
            </NButton>
          </NSpace>
        </template>
        <template v-if="detectorType === 'chevereto'">
          <div class="info-text">
            <p>{{ t('detector.lskyContent', { appName: t('app.name') }) }}</p>
          </div>
          <NSpace justify="end" :size="12" style="margin-top: 16px;">
            <NButton size="small" secondary @click="ignoreSite">{{ t('detector.ignore') }}</NButton>
            <NButton type="primary" size="small" :loading="isProcessing" @click="handleAddToAppChevereto">
              {{ t('detector.addToApp', { appName: t('app.name') }) }}
            </NButton>
          </NSpace>
        </template>
        <template v-if="detectorType === '16best'">
          <div class="info-text">
            <p>{{ t('detector.best16Content', { appName: t('app.name') }) }}</p>
          </div>
          <NSpace justify="end" :size="12" style="margin-top: 16px;">
            <NButton size="small" secondary @click="ignoreSite">{{ t('detector.ignore') }}</NButton>
            <NButton type="primary" size="small" :loading="isProcessing" @click="handleAddToApp16best">
              {{ t('detector.addToApp', { appName: t('app.name') }) }}
            </NButton>
          </NSpace>
        </template>
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

.info-text p {
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
