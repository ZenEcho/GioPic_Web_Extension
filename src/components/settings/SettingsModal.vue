<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useThemeStore, themeColors } from '@/stores/theme'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import browser from 'webextension-polyfill'
import SidebarSettings from './SidebarSettings.vue'
import SiteEditorSettings from './SiteEditorSettings.vue'
import { useMessage, useDialog } from 'naive-ui'
import { db } from '@/utils/storage'
import { getDefaultSettings } from '@/constants/defaultSettings'

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

const openMode = ref('tab')

const autoInject = ref(false)
const showSidebarSettings = ref(false)
const showSiteEditorSettings = ref(false)

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
    const res = await browser.storage.local.get('open-mode')
    if (res['open-mode']) {
        openMode.value = res['open-mode'] as string
    }
    const inject = await browser.storage.local.get('giopic-auto-inject')
    autoInject.value = !!inject['giopic-auto-inject']
    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    await refreshDesktopStatus()
})

onBeforeUnmount(() => {
    browser.runtime.onMessage.removeListener(handleRuntimeMessage)
})

async function setAutoInject(val: boolean) {
    autoInject.value = val
    await browser.storage.local.set({ 'giopic-auto-inject': val })
}

async function setOpenMode(mode: string) {
    openMode.value = mode
    await browser.storage.local.set({ 'open-mode': mode })
    try {
        await browser.runtime.sendMessage({ type: 'UPDATE_OPEN_MODE', mode })
    } catch (e) {
        console.log('Failed to notify background script', e)
    }
}

async function changeLocale(lang: string) {
    locale.value = lang
    // Use storage.local for locale to share with content scripts
    await browser.storage.local.set({ 'giopic-locale': lang })
    try {
        await browser.runtime.sendMessage({ type: 'UPDATE_LOCALE', lang })
    } catch (e) {
        console.log('Failed to notify background script', e)
    }
}

const currentVersion = ref('2.0.0')
const latestVersion = ref('')
const isChecking = ref(false)
const hasUpdate = ref(false)
const checkError = ref(false)

const openModeIcons: Record<string, string> = {
    tab: 'i-ph-browser',
    window: 'i-ph-app-window',
    action: 'i-ph-monitor'
}

const uiModeIcons: Record<string, string> = {
    classic: 'i-ph-layout',
    console: 'i-ph-terminal-window',
    center: 'i-ph-columns',
    simple: 'i-ph-square'
}

const tabs = [
    { key: 'general', label: 'settings.tabs.general', icon: 'i-ph-sliders' },
    { key: 'features', label: 'settings.tabs.features', icon: 'i-ph-puzzle-piece' },
    { key: 'about', label: 'settings.tabs.about', icon: 'i-ph-info' }
]
const activeTab = ref('general')

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

async function checkVersion(force = false) {
    if (isChecking.value) return

    // Check cache first if not forced  检查缓存是否过期
    if (!force) {
        try {
            const cached = localStorage.getItem('giopic-version-check')
            if (cached) {
                const { time, version } = JSON.parse(cached)
                // Cache valid for 6 hours 中文 缓存过期时间 6 小时
                if (Date.now() - time < 6 * 60 * 60 * 1000) {
                    latestVersion.value = version
                    hasUpdate.value = version !== currentVersion.value
                    return
                }
            }
        } catch (e) {
            console.warn('Failed to parse version cache', e)
        }
    }

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

            // Save to cache
            localStorage.setItem('giopic-version-check', JSON.stringify({
                time: Date.now(),
                version: latestVersion.value
            }))
        }
    } catch (e) {
        console.error('Failed to check version', e)
        checkError.value = true
    } finally {
        isChecking.value = false
    }
}

async function handleResetExtension() {
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
                await browser.storage.local.clear()

                // Restore default settings
                await browser.storage.local.set(getDefaultSettings())

                message.success(t('settings.dangerZone.resetSuccess'))
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
        :title="t('settings.title')" class="w-full max-w-3xl rounded-2xl" :segmented="false" :content-style="{ padding: 0 }">
        <div class="flex flex-col md:flex-row ">
            <!-- Sidebar -->
            <div class="flex md:flex-col flex-row md:w-48 shrink-0 overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 p-2 gap-1">
                <button v-for="tab in tabs" :key="tab.key"
                    class="flex-1 md:flex-none w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center md:justify-start gap-2 whitespace-nowrap"
                    :class="activeTab === tab.key 
                        ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'"
                    :style="activeTab === tab.key ? { color: 'var(--giopic-primary)' } : {}"
                    @click="activeTab = tab.key">
                    <div :class="tab.icon" class="text-lg" />
                    {{ t(tab.label) }}
                </button>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                <!-- General Tab -->
                <div v-show="activeTab === 'general'" class="space-y-6">
                    <div class="grid gap-6">
                        <!-- Appearance -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-palette" /> {{ t('settings.appearance') }}
                            </div>
                            <div class="flex gap-2">
                                <button
                                    class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                    :class="!themeStore.isDark ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="!themeStore.isDark ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="themeStore.isDark = false">
                                    <div class="i-ph-sun" /> {{ t('settings.lightMode') }}
                                </button>
                                <button
                                    class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                    :class="themeStore.isDark ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="themeStore.isDark ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="themeStore.isDark = true">
                                    <div class="i-ph-moon" /> {{ t('settings.darkMode') }}
                                </button>
                            </div>
                        </div>

                        <!-- Language -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-translate" /> {{ t('settings.language') }}
                            </div>
                            <div class="flex gap-2">
                                <button
                                    class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                    :class="locale === 'zh-CN' ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="locale === 'zh-CN' ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="changeLocale('zh-CN')">
                                    中文
                                </button>
                                <button
                                    class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                    :class="locale === 'en-US' ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="locale === 'en-US' ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="changeLocale('en-US')">
                                    English
                                </button>
                            </div>
                        </div>

                        <!-- Open Mode -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-arrow-square-out" /> {{ t('settings.openMode') }}
                            </div>
                            <div class="flex gap-2">
                                <button v-for="mode in ['tab', 'window', 'action']" :key="mode"
                                    class="flex-1 py-2 rounded-lg border transition-all font-medium text-sm flex items-center justify-center gap-2"
                                    :class="openMode === mode ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="openMode === mode ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="setOpenMode(mode)">
                                    <div :class="openModeIcons[mode]" /> {{ t(`settings.openModes.${mode}`) }}
                                </button>
                            </div>
                        </div>

                        <!-- UI Mode -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-layout" /> {{ t('settings.uiMode') }}
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button v-for="mode in ['classic', 'console', 'center', 'simple']" :key="mode"
                                    class="giopic-link-btn giopic-link-btn-primary flex-1 py-2 border font-medium text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                                    :class="themeStore.uiMode === mode ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    :style="themeStore.uiMode === mode ? { backgroundColor: 'var(--giopic-primary)' } : {}"
                                    @click="themeStore.setUiMode(mode as any)">
                                    <div :class="uiModeIcons[mode]" /> {{ t(`settings.uiModes.${mode}`) }}
                                </button>
                            </div>
                        </div>

                        <!-- Theme -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-swatches" /> {{ t('settings.theme') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <button v-for="(color, key) in themeColors" :key="key"
                                    class="giopic-icon-btn w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                    :style="{ backgroundColor: color.primary }" @click="themeStore.setThemeColor(key)">
                                    <div v-if="themeStore.currentColor === key"
                                        class="i-ph-check text-white text-lg font-bold" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Features Tab -->
                <div v-show="activeTab === 'features'" class="space-y-6">
                    <div class="grid gap-6">
                        <!-- Sidebar -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-sidebar" /> {{ t('settings.sidebar') }}
                            </div>
                            <button
                                class="giopic-link-btn giopic-link-btn-primary w-full py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                :class="'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                @click="showSidebarSettings = true">
                                <div class="i-ph-sliders-horizontal" /> {{ t('settings.sidebar') }}
                            </button>
                        </div>

                        <!-- Automation -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-magic-wand" /> {{ t('settings.automation') }}
                            </div>
                            <div class="space-y-2">
                                <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.autoInject') }}</span>
                                    <n-switch v-model:value="autoInject" @update:value="setAutoInject" />
                                </div>
                                <button
                                    class="giopic-link-btn giopic-link-btn-primary w-full py-2 border font-medium text-sm flex items-center justify-center gap-2"
                                    :class="'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                                    @click="showSiteEditorSettings = true">
                                    <div class="i-ph-list-dashes" /> {{ t('settings.siteEditor.manage') }}
                                </button>
                            </div>
                        </div>

                        <!-- Desktop Link -->
                        <div>
                            <div class="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">
                                <div class="i-ph-desktop" /> {{ t('settings.desktopLink.title') }}
                            </div>
                            <div class="space-y-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.desktopLink.enabled') }}</span>
                                    <n-switch v-model:value="desktopEnabled" @update:value="setDesktopLinkEnabled" />
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500 dark:text-gray-400">{{ t('settings.desktopLink.statusLabel') }}</span>
                                    <span :class="desktopStatusClass">{{ desktopStatusText }}</span>
                                </div>
                                <div class="text-xs text-gray-400 dark:text-gray-500">
                                    {{ t('settings.desktopLink.description') }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- About Tab -->
                <div v-show="activeTab === 'about'" class="space-y-6">
                    <!-- Version -->
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
                                    :disabled="isChecking" @click="checkVersion(true)">
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
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.about.developer') }}</span>
                                    <a href="https://github.com/ZenEcho" target="_blank"
                                        class="text-sm text-gray-500 hover:text-blue-500 transition-colors">ZenEcho</a>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.about.openSource') }}</span>
                                    <a href="https://github.com/ZenEcho/GioPic_Web_Extension/" target="_blank"
                                        class="text-sm text-blue-500 hover:underline flex items-center gap-1">
                                        <div class="i-ph-github-logo" /> GitHub
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Danger Zone -->
                    <div>
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
            </div>
        </div>
    </n-modal>
    <SidebarSettings v-model:show="showSidebarSettings" />
    <SiteEditorSettings v-model:show="showSiteEditorSettings" />
</template>
