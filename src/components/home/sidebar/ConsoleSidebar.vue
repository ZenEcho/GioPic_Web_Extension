<!--
 * Component Name: ConsoleSidebar
 * Author: GioPic Team
 * Description: 控制台模式侧边栏组件
 * 
 * Functional Domain:
 * Home (主页) - 侧边栏 (控制台模式)
 * 
 * Key Features:
 * - 视图导航：切换上传/历史记录视图
 * - 节点管理：折叠/展开节点列表，展示节点状态
 * - 布局控制：支持侧边栏折叠/展开，节省空间
 * - 全局控制：主题切换、设置入口、布局切换
 * - 状态持久化：记住侧边栏折叠状态
 * 
 * Props:
 * - selectedIds (string[]): 当前选中的节点 ID 列表
 * - currentView (string): 当前视图 ('upload' | 'history')
 * 
 * Events:
 * - update:selectedIds: 更新选中节点
 * - navigate: 切换视图
 * - add: 触发添加节点
 * - edit: 触发编辑节点
 * - openSettings: 打开设置面板
 -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useConfigStore } from '@/stores/config'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import type { DriveConfig } from '@/types'
import { useDialog, useMessage } from 'naive-ui'
import browser from 'webextension-polyfill'
import { getStorageIcon } from '@/utils/icon'
import { useSidebar } from '@/composables/useSidebar'

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

const currentVersion = ref('2.0.0')
const isConfigExpanded = ref(true)
const isCollapsed = ref(false)
const {

    showImportModal,
    importJson,
    toggleConfigSelection,
    handleDelete,
    handleShare,
    handleShareAll,
    handleRefresh,
    handleImport,
    confirmImport
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

    browser.runtime.onMessage.addListener((message: any) => {
        if (message.type === 'REFRESH_CONFIG') {
            configStore.reload()
        }
    })
})

async function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value
    await browser.storage.local.set({ 'console-sidebar-collapsed': isCollapsed.value })
}
</script>

<template>
    <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-300"
        :class="isCollapsed ? 'w-20' : ' w-72'">
        <!-- 头部 Logo -->
        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center"
            :class="isCollapsed ? 'justify-center' : 'justify-between'">
            <div class="flex items-center gap-2">
                <!-- <div 
                    class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm flex-shrink-0">
                    <div class="i-ph-image-square text-sm" />
                </div> -->
                <div
                    class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center  shadow-sm">
                    <img src="@/assets/icons/logo64.png" alt="logo" class="h-6 hidden md:block">
                </div>
                <span v-show="!isCollapsed"
                    class="text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap transition-opacity duration-200">{{
                        t('home.myImages') }}</span>
            </div>
            <div v-show="!isCollapsed" class="flex items-center">
                <button
                    class="giopic-icon-btn w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="themeStore.toggleDark()"
                    :title="themeStore.isDark ? t('settings.lightMode') : t('settings.darkMode')">
                    <div class="text-lg" :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
                </button>
                <!-- //切换布局 -->
                <button
                    class="giopic-icon-btn w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="themeStore.setUiMode(themeStore.uiMode === 'console' ? 'classic' : 'console')">
                    <div class="i-ph-layout text-lg" />
                </button>

                <button
                    class="giopic-icon-btn w-8 h-8 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="emit('openSettings')">
                    <div class="i-ph-gear-six text-lg" />
                </button>

            </div>
        </div>

        <!-- 导航区 -->
        <div class="p-3 space-y-1.5">
            <button
                class="nav-btn dark:hover:bg-gray-700 w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
                :class="[currentView === 'upload' ? 'active' : 'inactive', isCollapsed ? 'justify-center' : 'gap-3']"
                @click="emit('navigate', 'upload')" :title="isCollapsed ? t('home.sidebar.upload') : ''">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    :class="currentView === 'upload' ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'">
                    <div class="i-ph-cloud-arrow-up text-lg" />
                </div>
                <span v-show="!isCollapsed" class="whitespace-nowrap">{{ t('home.sidebar.upload') }}</span>
            </button>

            <button
                class="nav-btn w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
                :class="[currentView === 'history' ? 'active' : 'inactive', isCollapsed ? 'justify-center' : 'gap-3']"
                @click="emit('navigate', 'history')" :title="isCollapsed ? t('home.sidebar.history') : ''">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                    :class="currentView === 'history' ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'">
                    <div class="i-ph-clock-counter-clockwise text-lg" />
                </div>
                <span v-show="!isCollapsed" class="whitespace-nowrap">{{ t('home.sidebar.history') }}</span>
            </button>
        </div>

        <!-- 存储配置区 -->
        <div class="flex-1 overflow-hidden flex flex-col">
            <!-- 标题栏 -->
            <div class="px-4 py-3 flex items-center justify-between" v-show="!isCollapsed">
                <div class="flex items-center gap-2">
                    <div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {{ t('home.sidebar.nodes') }}
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
                            ? 'bg-primary/20 border-primary/30 dark:bg-primary/10 dark:border-primary/20'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700',
                        isCollapsed ? 'flex justify-center' : '']" @click="toggleConfigSelection(config.id)"
                        :title="isCollapsed ? config.name : ''">

                        <div class="flex items-start" :class="isCollapsed ? 'justify-center' : 'gap-3'">
                            <!-- 存储类型图标 -->
                            <div class="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                :class="selectedIds.includes(config.id)
                                    ? 'bg-primary text-white'
                                    : 'bg-white dark:bg-gray-600 text-gray-400 dark:text-gray-300 shadow-sm'">
                                <div :class="getStorageIcon(config.type)" class="text-lg" />
                            </div>

                            <!-- 配置信息 -->
                            <div v-show="!isCollapsed" class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium truncate" :class="selectedIds.includes(config.id)
                                        ? 'text-primary dark:text-primary'
                                        : 'text-gray-700 dark:text-gray-200'">
                                        {{ config.name }}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                    {{ config.type }}
                                </div>
                            </div>
                        </div>

                        <!-- 操作按钮 - 悬停显示 -->
                        <div v-if="!isCollapsed"
                            class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                class="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-gray-600 text-gray-400 hover:text-primary shadow-sm transition-colors"
                                @click.stop="handleShare(config)" :title="t('home.share')">
                                <div class="i-ph-share-network text-sm" />
                            </button>
                            <button
                                class="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-gray-600 text-gray-400 hover:text-primary shadow-sm transition-colors"
                                @click.stop="emit('edit', config)" :title="t('common.edit')">
                                <div class="i-ph-pencil-simple text-sm" />
                            </button>
                            <button
                                class="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-gray-600 text-gray-400 hover:text-red-500 shadow-sm transition-colors"
                                @click.stop="handleDelete(config)" :title="t('common.delete')">
                                <div class="i-ph-trash text-sm" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 底部 -->
        <div class="p-4 border-t border-gray-100 dark:border-gray-700">
            <div class="flex items-center" :class="isCollapsed ? 'flex-col gap-3' : 'justify-between'">
                <div v-show="!isCollapsed" class="flex items-center gap-2 text-xs text-gray-400">
                    <div
                        class="w-5 h-5 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                        <div class="i-ph-sparkle text-primary text-[10px]" />
                    </div>
                    <span>v{{ currentVersion }}</span>
                </div>
                <div class="flex items-center gap-1" :class="isCollapsed ? 'flex-col' : ''">
                    <button v-show="!isCollapsed"
                        class="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                        @click="handleShareAll" :title="t('home.shareAll')">
                        <div class="i-ph-share-network text-sm" />
                    </button>
                    <button v-show="!isCollapsed"
                        class="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                        @click="handleImport" :title="t('home.import')">
                        <div class="i-ph-download-simple text-sm" />
                    </button>
                    <button
                        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                        @click="toggleCollapse" :title="isCollapsed ? t('common.expand') : t('common.collapse')">
                        <div class="text-lg" :class="isCollapsed ? 'i-ph-caret-right' : 'i-ph-caret-left'" />
                    </button>
                </div>
            </div>
        </div>

        <!-- 导入弹窗 -->
        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />
    </div>
</template>

<style scoped>
/* 导航按钮样式 */
.nav-btn.active {
    background: linear-gradient(135deg, var(--giopic-primary), color-mix(in srgb, var(--giopic-primary) 80%, #000));
    color: white;
    box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--giopic-primary) 40%, transparent);
}


.nav-btn.inactive {
    color: #6b7280;
}


:global(.dark) .nav-btn.inactive {
    color: #d1d5db;
}

:global(.dark) .nav-btn.inactive:hover {
    background-color: #374151;
}



/* 滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #d1d5db;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #374151;
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #4b5563;
}

/* 配置卡片悬停效果 */
.config-card:hover .group-hover\:opacity-100 {
    opacity: 1;
}
</style>
