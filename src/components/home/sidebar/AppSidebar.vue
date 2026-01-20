<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import type { DriveConfig } from '@/types'
import browser from 'webextension-polyfill'
import { useSidebar } from '@/composables/useSidebar'
import ImportConfigModal from '@/components/home/sidebar/ImportConfigModal.vue'

const props = defineProps<{
    selectedIds: string[],
    currentView: string
}>()

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void
    (e: 'navigate', view: 'upload' | 'history'): void
    (e: 'add'): void
    (e: 'edit', config: DriveConfig): void
    (e: 'openSettings'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const themeStore = useThemeStore()

const isElectron = window.ipcRenderer !== undefined

const currentVersion = ref('2.0.0')
const isConfigExpanded = ref(true)
const isCollapsed = ref(false)
const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#ef4444')

const {
    toggleConfigSelection,
    handleRefresh,
    handleImport,
    confirmImport,
    showImportModal,
    importJson
} = useSidebar(props, emit)

onMounted(async () => {
    try {
        const manifest = browser.runtime.getManifest()
        if (manifest && manifest.version) {
            currentVersion.value = manifest.version
        }

        const storage = await browser.storage.local.get('console-sidebar-collapsed')
        isCollapsed.value = !!storage['console-sidebar-collapsed']
    } catch (e) {
        console.warn('Failed to get manifest version or storage', e)
    }

    browser.runtime.onMessage.addListener(async (message: any) => {
        if (message.type === 'REFRESH_CONFIG') {
            await configStore.reload()
        }
    })
})

async function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value
    await browser.storage.local.set({ 'console-sidebar-collapsed': isCollapsed.value })
}
</script>

<template>
    <div class="flex-shrink-0 bg-white dark:bg-gray-800 flex flex-col h-full transition-all duration-300"
        :class="[isCollapsed ? 'w-20' : 'w-64', isElectron ? 'pt-12' : '']">
        
        <!-- 头部 Logo (Web Only) -->
        <div v-if="!isElectron" class="px-4 pb-4 pt-4 flex items-center app-region-no-drag"
            :class="isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'">
            <div class="flex items-center gap-2">
                <div
                    class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center  shadow-sm">
                    <img src="@/assets/icons/logo64.png" alt="logo" class="h-6">
                </div>
                <span v-show="!isCollapsed"
                    class="text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap transition-opacity duration-200">{{
                        t('home.myImages') }}</span>
            </div>
            <div class="flex items-center gap-1" :class="isCollapsed ? 'flex-col' : ''">
                <button
                    class="giopic-icon-btn w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="themeStore.toggleDark()"
                    :title="themeStore.isDark ? t('settings.lightMode') : t('settings.darkMode')">
                    <div class="text-lg" :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
                </button>
                <button
                    class="giopic-icon-btn w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="emit('openSettings')" :title="t('settings.title')">
                    <div class="i-ph-gear text-lg" />
                </button>
            </div>
        </div>

        <!-- 导航区 -->
        <div class="p-3 space-y-1.5">
            <button
                class="nav-btn dark:hover:bg-gray-700 w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
                :class="[currentView === 'upload' ? 'active' : 'inactive', isCollapsed ? 'justify-center' : 'gap-3']"
                @click="emit('navigate', 'upload')" :title="isCollapsed ? t('home.nav.upload') : ''">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    :class="currentView === 'upload' ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'">
                    <div class="i-ph-cloud-arrow-up text-lg" />
                </div>
                <span v-show="!isCollapsed" class="whitespace-nowrap">{{ t('home.nav.upload') }}</span>
            </button>

            <button
                class="nav-btn w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
                :class="[currentView === 'history' ? 'active' : 'inactive', isCollapsed ? 'justify-center' : 'gap-3']"
                @click="emit('navigate', 'history')" :title="isCollapsed ? t('home.nav.history') : ''">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    :class="currentView === 'history' ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'">
                    <div class="i-ph-clock-counter-clockwise text-lg" />
                </div>
                <span v-show="!isCollapsed" class="whitespace-nowrap">{{ t('home.nav.history') }}</span>
            </button>
        </div>

        <!-- 存储配置区 -->
        <div class="flex-1 overflow-hidden flex flex-col">
            <!-- 标题栏 -->
            <div class="px-4 py-3 flex items-center justify-between" v-show="!isCollapsed">
                <div class="flex items-center gap-2">
                    <div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {{ t('home.nodes') }}
                    </div>
                    <div
                        class="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        {{ configStore.configs.length }}
                    </div>
                </div>
                <div class="flex items-center gap-0.5">
                    <button
                        class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                        @click="handleRefresh" :title="t('home.refresh')">
                        <div class="i-ph-arrows-clockwise text-sm" />
                    </button>
                    <button
                        class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                        @click="handleImport" :title="t('home.importTitle')">
                        <div class="i-ph-download-simple text-sm" />
                    </button>
                    <button
                        class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                        @click="emit('add')" :title="t('home.addNode')">
                        <div class="i-ph-plus-bold text-sm" />
                    </button>
                    <button
                        class="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                        @click="isConfigExpanded = !isConfigExpanded">
                        <div class="transition-transform duration-200" :class="isConfigExpanded ? 'rotate-180' : ''">
                            <div class="i-ph-caret-down text-sm" />
                        </div>
                    </button>
                </div>
            </div>

            <!-- 配置列表 -->
            <div class="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar transition-all duration-300"
                :class="[isConfigExpanded || isCollapsed ? 'opacity-100' : 'opacity-0 max-h-0 pointer-events-none']">

                <!-- 空状态 -->
                <div v-if="configStore.configs.length === 0"
                    class="flex flex-col items-center justify-center py-8 px-4">
                    <div
                        class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                        <div class="i-ph-folder-simple-dashed text-2xl text-gray-300 dark:text-gray-600" />
                    </div>
                    <div v-show="!isCollapsed" class="text-sm text-gray-400 dark:text-gray-500 text-center mb-3">{{
                        t('home.noNodes') }}</div>
                    <button v-show="!isCollapsed"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                        @click="emit('add')">
                        <span class="flex items-center gap-1">
                            <div class="i-ph-plus-bold" />
                            {{ t('home.addNode') }}
                        </span>
                    </button>
                </div>

                <!-- 配置卡片列表 -->
                <div class="space-y-2">
                    <div v-for="config in configStore.configs" :key="config.id"
                        class="config-card group relative rounded-xl p-3 cursor-pointer transition-all duration-200 border"
                        :class="[selectedIds.includes(config.id)
                            ? 'bg-primary/5 border-primary shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700',
                        isCollapsed ? 'flex justify-center' : '']" @click="toggleConfigSelection(config.id)"
                        :title="isCollapsed ? config.name : ''">

                        <div class="flex items-start" :class="isCollapsed ? 'justify-center' : 'gap-3'">
                            <!-- 存储类型图标 -->
                            <div class="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                :class="selectedIds.includes(config.id)
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 group-hover:bg-white dark:group-hover:bg-gray-500 shadow-sm'">
                                <div :class="config.type === 'lsky' ? 'i-ph-cloud' : 'i-ph-hard-drives'" class="text-lg" />
                                
                                <!-- 状态指示点 -->
                                <div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800"
                                    :class="config.enabled ? 'bg-green-500' : 'bg-gray-300'"></div>
                            </div>

                            <div v-show="!isCollapsed" class="flex-1 min-w-0">
                                <div class="flex items-center justify-between mb-0.5">
                                    <span class="font-bold text-sm truncate"
                                        :class="selectedIds.includes(config.id) ? 'text-primary' : 'text-gray-700 dark:text-gray-200'">
                                        {{ config.name }}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-400 truncate flex items-center gap-1">
                                    <span class="uppercase">{{ config.type }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 底部折叠按钮 -->
             <div class="p-3 border-t border-gray-100 dark:border-gray-700 mt-auto">
                <button
                    class="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    @click="toggleCollapse">
                    <div class="i-ph-caret-double-left text-lg transition-transform duration-300"
                        :class="isCollapsed ? 'rotate-180' : ''" />
                </button>
            </div>
        </div>
        
        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />
    </div>
</template>

<style scoped>
.nav-btn.active {
    background-color: v-bind(primaryColor);
    color: white;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.nav-btn.inactive {
    color: #6b7280;
}

.nav-btn.inactive:hover {
    background-color: #f3f4f6;
    color: #374151;
}

:global(.dark) .nav-btn.inactive {
    color: #9ca3af;
}

:global(.dark) .nav-btn.inactive:hover {
    background-color: #374151;
    color: #e5e7eb;
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 4px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
}

:global(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #374151;
}

.text-primary {
    color: v-bind(primaryColor);
}

.bg-primary {
    background-color: v-bind(primaryColor);
}

.border-primary {
    border-color: v-bind(primaryColor);
}

.hover\:text-primary:hover {
    color: v-bind(primaryColor);
}

.bg-primary\/5 {
    background-color: color-mix(in srgb, v-bind(primaryColor) 5%, transparent);
}

.bg-primary\/10 {
    background-color: color-mix(in srgb, v-bind(primaryColor) 10%, transparent);
}

.hover\:bg-primary\/10:hover {
    background-color: color-mix(in srgb, v-bind(primaryColor) 10%, transparent);
}

.to-primary\/70 {
    --un-gradient-to: color-mix(in srgb, v-bind(primaryColor) 70%, transparent);
}

.from-primary {
    --un-gradient-from: v-bind(primaryColor);
    --un-gradient-stops: var(--un-gradient-from), var(--un-gradient-to);
}
</style>
