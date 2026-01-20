<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useThemeStore, themeColors } from '@/stores/theme'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import browser from 'webextension-polyfill'
import { useMessage, useDialog } from 'naive-ui'
import { db } from '@/utils/storage'

type DesktopLinkStatusType = 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'error'

const props = defineProps<{
    show: boolean
}>()

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void
}>()

const { t, locale } = useI18n()
const themeStore = useThemeStore()
const message = useMessage()
const dialog = useDialog()

const isElectron = window.ipcRenderer !== undefined

const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#409eff')
const autoInject = ref(false)

const desktopEnabled = ref(false)
const desktopStatus = ref<DesktopLinkStatusType>('disabled')

const desktopStatusText = computed(() => t(`settings.desktopLink.status.${desktopStatus.value}`))

const desktopStatusClass = computed(() => {
    if (desktopStatus.value === 'connected') {
        return 'text-green-600 dark:text-green-400'
    }
    if (desktopStatus.value === 'connecting') {
        return 'text-blue-500'
    }
    if (desktopStatus.value === 'error') {
        return 'text-red-500'
    }
    return 'text-gray-500'
})

function applyDesktopStatus(payload: any) {
    if (!payload || typeof payload !== 'object') return
    desktopEnabled.value = !!payload.enabled
    const status = payload.status as DesktopLinkStatusType
    if (status === 'disabled' || status === 'disconnected' || status === 'connecting' || status === 'connected' || status === 'error') {
        desktopStatus.value = status
    }
}

const handleRuntimeMessage = (message: any) => {
    if (message.type === 'DESKTOP_LINK_STATUS' && message.payload) {
        applyDesktopStatus(message.payload)
    }
}

async function refreshDesktopStatus() {
    try {
        const res = await browser.runtime.sendMessage({ type: 'DESKTOP_LINK_GET_STATUS' })
        applyDesktopStatus(res)
    } catch { }
}

async function setDesktopLinkEnabled(val: boolean) {
    desktopEnabled.value = val
    try {
        await browser.runtime.sendMessage({ type: 'DESKTOP_LINK_SET_ENABLED', enabled: val })
    } catch { }
}

onMounted(async () => {
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    await refreshDesktopStatus()
})

onBeforeUnmount(() => {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage)
})

async function changeLocale(lang: string) {
    locale.value = lang
    // Use storage.local for locale to share with content scripts
    await browser.storage.local.set({ 'giopic-locale': lang })
    try {
        window.ipcRenderer?.send('update-locale', lang)
    } catch (e) {
        console.log('Failed to notify main process', e)
    }
}

const currentVersion = ref('2.0.0')
const latestVersion = ref('')
const isChecking = ref(false)
const hasUpdate = ref(false)
const checkError = ref(false)



onMounted(() => {
    try {
        const manifest = browser.runtime.getManifest()
        if (manifest && manifest.version) {
            currentVersion.value = manifest.version
        }
    } catch (e) {
        console.warn('Failed to get manifest version', e)
    }
    checkVersion()
})

async function checkVersion() {
    if (isChecking.value) return
    isChecking.value = true
    checkError.value = false
    try {
        let tagName = ''
        // First try releases/latest
        let res = await fetch('https://api.github.com/repos/ZenEcho/GioPic_Web_Extension/releases/latest')

        if (res.ok) {
            const data = await res.json()
            tagName = data.tag_name
        } else if (res.status === 404) {
            // Fallback to tags if no release is found
            res = await fetch('https://api.github.com/repos/ZenEcho/GioPic_Web_Extension/tags')
            if (res.ok) {
                const data = await res.json()
                if (data && data.length > 0) {
                    tagName = data[0].name
                } else {
                    throw new Error('No tags found')
                }
            } else {
                throw new Error('Network response was not ok')
            }
        } else {
            throw new Error('Network response was not ok')
        }

        if (tagName) {
            latestVersion.value = tagName.replace(/^v/, '')
            hasUpdate.value = latestVersion.value !== currentVersion.value
        }
    } catch (e) {
        console.error('Failed to check version', e)
        checkError.value = true
    } finally {
        isChecking.value = false
    }
}

function openDevTools() {
    if (!window.ipcRenderer) {
        message.error(t('common.error'))
        return
    }
    try {
        window.ipcRenderer.send('open-devtools')
    } catch (e) {
        console.error('Failed to open devtools', e)
        message.error(t('common.error'))
    }
}

const handleResetExtension = async () => {
    dialog.warning({
        title: t('settings.dangerZone.title'),
        content: t('settings.dangerZone.resetConfirm'),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
            try {
                // Clear IndexedDB
                await db.clear()
                // Clear localStorage
                localStorage.clear()
                // Clear browser.storage.local
                if (browser.storage.local.clear) {
                    await browser.storage.local.clear()
                } else {
                     await browser.storage.local.remove(await browser.storage.local.get(null).then(Object.keys))
                }
                
                message.success(t('settings.dangerZone.resetSuccess'))
                
                // Reload page after a short delay
                setTimeout(() => {
                    window.location.reload()
                }, 1000)
            } catch (e) {
                console.error('Reset failed', e)
                message.error(t('common.error'))
            }
        }
    })
}
</script>

<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" preset="card"
        :title="t('settings.title')" class="w-full max-w-2xl rounded-2xl" :segmented="false">
        <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div class="grid gap-4 md:grid-cols-2">
                <!-- 外观设置 -->
                <div>
                    <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                        <div class="i-ph-palette" /> {{ t('settings.appearance') }}
                    </div>
                    <div class="flex gap-2 ">
                        <button
                            class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                            :class="!themeStore.isDark ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                            :style="!themeStore.isDark ? { backgroundColor: primaryColor } : {}"
                            @click="themeStore.isDark = false">
                            <div class="i-ph-sun" /> {{ t('settings.lightMode') }}
                        </button>
                        <button
                            class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                            :class="themeStore.isDark ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                            :style="themeStore.isDark ? { backgroundColor: primaryColor } : {}"
                            @click="themeStore.isDark = true">
                            <div class="i-ph-moon" /> {{ t('settings.darkMode') }}
                        </button>
                    </div>
                </div>

                <!-- 语言设置 -->
                <div>
                    <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                        <div class="i-ph-translate" /> {{ t('settings.language') }}
                    </div>
                    <div class="flex gap-2">
                        <button class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                            :class="locale === 'zh-CN' ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                            :style="locale === 'zh-CN' ? { backgroundColor: primaryColor } : {}"
                            @click="changeLocale('zh-CN')">
                            中文
                        </button>
                        <button class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                            :class="locale === 'en-US' ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                            :style="locale === 'en-US' ? { backgroundColor: primaryColor } : {}"
                            @click="changeLocale('en-US')">
                            English
                        </button>
                    </div>
                </div>
                <!-- 界面布局 -->
                <!-- Removed -->

                <!-- 主题色设置 -->
                <div class="md:col-span-2">
                    <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                        <div class="i-ph-swatches" /> {{ t('settings.theme') }}
                    </div>
                    <div class=" flex items-center  gap-2">
                        <button v-for="(color, key) in themeColors" :key="key"
                            class="giopic-icon-btn w-8 h-8 rounded-full flex items-center justify-center"
                            :style="{ backgroundColor: color.primary }" @click="themeStore.setThemeColor(key)">
                            <div v-if="themeStore.currentColor === key"
                                class="i-ph-check text-white text-lg font-bold" />
                        </button>
                    </div>
                </div>
            </div>
            <!-- 版本 -->
            <div>
                <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                    <div class="i-ph-info" /> {{ t('settings.version.title') }}
                </div>
                <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                    <div class="flex items-center justify-between" :class="latestVersion ? 'mb-2' : ''">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {{ t('settings.version.current') }}: v{{ currentVersion }}
                        </span>
                        <button class="text-xs px-2 py-1 rounded border transition-colors"
                            :class="isChecking ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white'"
                            :disabled="isChecking" @click="checkVersion">
                            {{ isChecking ? t('settings.version.checking') : t('settings.version.check') }}
                        </button>
                    </div>

                    <div v-if="latestVersion" class="text-sm">
                        <div v-if="hasUpdate"
                            class="flex items-center justify-between text-green-600 dark:text-green-400">
                            <span>{{ t('settings.version.newVersion', { version: latestVersion }) }}</span>
                            <a href="https://github.com/ZenEcho/GioPic_Web_Extension/" target="_blank"
                                class="giopic-link-btn text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded hover:bg-green-200 dark:hover:bg-green-900/50">
                                {{ t('settings.version.update') }}
                            </a>
                        </div>
                        <div v-else class="text-gray-500">
                            {{ t('settings.version.upToDate') }}
                        </div>
                    </div>
                    <div v-if="checkError" class="text-sm text-red-500 mt-2">
                        {{ t('settings.version.failed') }}
                    </div>

                    <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                                t('settings.about.developer') }}</span>
                            <a href="https://github.com/ZenEcho" target="_blank"
                                class="text-sm text-gray-500 hover:text-blue-500 transition-colors">ZenEcho</a>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{
                                t('settings.about.openSource') }}</span>
                            <a href="https://github.com/ZenEcho/GioPic_Web_Extension/" target="_blank"
                                class="text-sm text-blue-500 hover:underline flex items-center gap-1">
                                <div class="i-ph-github-logo" /> GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 开发者选项 -->
            <div v-if="isElectron">
                <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                    <div class="i-ph-code" /> 开发者选项
                </div>
                <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                    <button
                        class="w-full py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        @click="openDevTools">
                        <div class="i-ph-terminal-window" /> 打开控制台
                    </button>
                </div>
            </div>

            <!-- 危险区域 -->
            <div class="md:col-span-2">
                <div class="text-sm font-bold text-red-500 mb-2 flex items-center gap-1">
                    <div class="i-ph-warning-circle" /> {{ t('settings.dangerZone.title') }}
                </div>
                <div class="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
                    <button
                        class="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        @click="handleResetExtension">
                        <div class="i-ph-trash" /> {{ t('settings.dangerZone.reset') }}
                    </button>
                </div>
            </div>
        </div>
    </n-modal>
</template>
