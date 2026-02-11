<!--
 * Component Name: ClassicSidebar
 * Author: GioPic Team
 * Description: 经典模式侧边栏组件
 * 
 * Functional Domain:
 * Home (主页) - 侧边栏 (经典模式)
 * 
 * Key Features:
 * - 节点列表：展示和管理存储节点
 * - 主题控制：切换亮色/暗色模式，切换主题色
 * - 布局切换：在经典模式和控制台模式间切换
 * - 快捷操作：刷新、分享全部、设置入口
 * - 移动端适配：支持移动端抽屉式展开/折叠
 * 
 * Props:
 * - selectedIds (string[]): 当前选中的节点 ID 列表
 * 
 * Events:
 * - update:selectedIds: 更新选中节点
 * - add: 触发添加节点
 * - edit: 触发编辑节点
 * - openSettings: 打开设置面板
 -->
<script setup lang="ts">
import { useConfigStore } from '@/stores/config'
import { useThemeStore, themeColors } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import type { DriveConfig } from '@/types'
import { ref, onMounted } from 'vue'

import { getStorageIcon } from '@/utils/icon'
import { useSidebar } from '@/composables/useSidebar'
import browser from 'webextension-polyfill'


const props = defineProps<{
    selectedIds: string[]
}>()

const emit = defineEmits<{
    (e: 'update:selectedIds', value: string[]): void
    (e: 'add'): void
    (e: 'edit', config: DriveConfig): void
    (e: 'openSettings'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const themeStore = useThemeStore()
const isHovered = ref(false)

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
} = useSidebar(props, emit as any)

onMounted(() => {
    browser.runtime.onMessage.addListener((message: any) => {
        if (message.type === 'REFRESH_CONFIG') {
            configStore.reload()
        }
    })
})
</script>

<template>
    <div class="config-list-container flex flex-col bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex-shrink-0 transition-all duration-300"
        :class="[
            isHovered ? 'mobile-expanded' : 'mobile-collapsed',
            'md:w-[288px] md:h-auto md:static md:translate-y-0 md:m-6'
        ]" @mouseenter="isHovered = true" @mouseleave="isHovered = false" @click="isHovered = true">
        <div class="flex flex-row items-center mb-8 header-section">
            <div class="w-full text-2xl font-black tracking-tighter dark:text-white">{{ t('app.name') }}-<span
                    class="text-primary">{{ t('app.nameSuffix') }}</span></div>

            <div class="flex flex-row items-center gap-1">
                 <button class="giopic-icon-btn text-gray-400 hover:text-primary text-xl"
                        @click="themeStore.isDark = !themeStore.isDark">
                        <div :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
                    </button>
                <button
                    class="giopic-icon-btn  rounded-lg text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    @click="themeStore.setUiMode(themeStore.uiMode === 'console' ? 'classic' : 'console')">
                    <div class="i-ph-layout text-lg" />
                </button>
                <button class="giopic-icon-btn text-gray-400 hover:text-primary text-xl"
                    @click.stop="emit('openSettings')">
                    <div class="i-ph-gear" />
                </button>
            </div>
        </div>

        <div class="content-section flex flex-col flex-1 overflow-hidden transition-all duration-300">
            <div
                class="mb-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex flex-row justify-between">
                <div class="flex flex-row items-center gap-2">
                    <div>{{ t('home.nodes') }}</div>
                    <div class="flex flex-row items-center">
                        <button v-for="(color, key) in themeColors" :key="key" class="giopic-icon-btn w-3 h-3 mx-[1px]"
                            :style="{ backgroundColor: color.primary }" @click="themeStore.setThemeColor(key)">
                            <div v-if="themeStore.currentColor === key"
                                class="i-ph-check text-white text-lg font-bold" />
                        </button>
                    </div>
                </div>

                <div class="flex flex-row items-center gap-1">

                    <button class="giopic-icon-btn text-gray-400 hover:text-primary text-xl" :title="t('home.refresh')"
                        @click.stop="handleRefresh">
                        <div class="i-ph-arrows-clockwise" />
                    </button>
                    <button class="giopic-icon-btn text-gray-400 hover:text-primary text-xl" :title="t('home.shareAll')"
                        @click.stop="handleShareAll">
                        <div class="i-ph-share-network" />
                    </button>
                   
                </div>

            </div>

            <div class="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
                <div v-for="config in configStore.configs" :key="config.id"
                    class="group relative rounded-xl p-2.5 cursor-pointer transition-all duration-200 border border-transparent"
                    :class="props.selectedIds.includes(config.id)
                        ? ' bg-primary/20 dark:bg-gray-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-200 dark:hover:border-gray-700 '"
                    @click="toggleConfigSelection(config.id)">

                    <div class="flex items-center gap-3">
                        <!-- 图标 -->
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                            :class="props.selectedIds.includes(config.id)
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'">
                            <div :class="getStorageIcon(config.type)" class="text-xl" />
                        </div>

                        <!-- 信息 -->
                        <div class="flex-1 min-w-0 flex flex-col justify-center">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold truncate transition-colors"
                                    :class="props.selectedIds.includes(config.id) ? 'text-primary' : 'text-gray-700 dark:text-gray-200'">
                                    {{ config.name }}
                                </span>
                                <!-- <div v-if="props.selectedIds.includes(config.id)"
                                    class="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                    <div class="i-ph-check-bold text-[10px] text-white" />
                                </div> -->
                            </div>
                            <div
                                class="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-0.5">
                                {{ config.type }}
                            </div>
                        </div>

                        <!-- 操作按钮 (悬停显示，覆盖部分内容) -->
                        <div
                            class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/60 dark:bg-gray-800/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                            <button
                                class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-primary hover:bg-primary/20 transition-colors"
                                @click.stop="handleShare(config)" :title="t('home.share')">
                                <div class="i-ph-share-network text-sm" />
                            </button>
                            <button
                                class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-primary hover:bg-primary/20 transition-colors"
                                @click.stop="emit('edit', config)" :title="t('common.edit')">
                                <div class="i-ph-pencil-simple text-sm" />
                            </button>
                            <button
                                class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                @click.stop="handleDelete(config)" :title="t('common.delete')">
                                <div class="i-ph-trash text-sm" />
                            </button>
                        </div>
                    </div>
                </div>

                <div v-if="configStore.configs.length === 0"
                    class="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
                    <div
                        class="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                        <div class="i-ph-folder-dashed text-2xl text-gray-300 dark:text-gray-600" />
                    </div>
                    <div class="text-xs text-gray-400 font-medium">{{ t('home.noNodes') }}</div>
                </div>
            </div>

            <div class="mt-4 flex gap-3 flex-shrink-0">
                <button @click="handleImport"
                    class="rounded-lg flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium hover:border-primary hover:text-primary   flex items-center justify-center gap-2">
                    <div class="i-ph-download-simple w-4 h-4" />
                    {{ t('home.import') }}
                </button>
                <button @click="emit('add')"
                    class=" rounded-lg flex-[2] py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium hover:border-primary hover:text-primary   flex items-center justify-center gap-2">
                    <div class="i-ph-plus-circle-fill w-4 h-4" />
                    {{ t('home.addNode') }}
                </button>
            </div>
        </div>

        <!-- 导入弹窗 -->
        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />
    </div>

</template>

<style scoped>
/* Mobile styles (< 720px) */
@media (max-width: 768px) {
    .config-list-container {
        position: fixed;
        left: 1.2rem;
        right: 1.2rem;
        z-index: 50;
        /* Default collapsed state styles */
        bottom: 4px;
        height: auto;
        max-height: 16px;
        /* Only show header */
        overflow: hidden;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);

    }

    .config-list-container.mobile-expanded {
        bottom: 2px;
        height: 70vh;
        /* Takes up 70% of screen height */
        max-height: none;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

    }

    .config-list-container.mobile-collapsed .content-section {
        opacity: 0;
        pointer-events: none;
    }

    .config-list-container.mobile-expanded .content-section {
        opacity: 1;
        pointer-events: auto;
    }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
    border-radius: 4px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #d1d5db;
}

/* Dark mode scrollbar */
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #374151;
}

:global(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #4b5563;
}




:global(.dark) .dark\:hover\:bg-red-900\/20:hover {
    background-color: color-mix(in srgb, #ef4444 20%, transparent);
}
</style>
