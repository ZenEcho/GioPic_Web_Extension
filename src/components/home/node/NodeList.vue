<!--
 * Component Name: NodeList
 * Author: GioPic Team
 * Description: 存储节点列表展示与管理组件
 * 
 * Functional Domain:
 * Home (主页) - 侧边栏/节点管理
 * 
 * Key Features:
 * - 节点展示：网格化展示已配置的存储节点
 * - 节点操作：支持添加、编辑、删除、分享节点配置
 * - 导入导出：支持节点配置的 JSON 导入与导出
 * - 状态管理：集成 ConfigStore 管理节点选中状态
 * - 响应式布局：适配不同屏幕尺寸的网格显示
 * 
 * Props:
 * - None (依赖 ConfigStore 和 SidebarStore)
 * 
 * Events:
 * - add: 触发添加新节点操作
 * - edit: 触发编辑节点操作 (参数: config对象)
 -->
<script setup lang="ts">

import { useConfigStore } from '@/stores/config'
import { useSidebar } from '@/composables/useSidebar'
import { useI18n } from 'vue-i18n'
import { getStorageIcon } from '@/utils/icon'

import type { DriveConfig } from '@/types'
import ImportConfigModal from '@/components/home/sidebar/ImportConfigModal.vue'

const emit = defineEmits<{
    (e: 'add'): void
    (e: 'edit', config: DriveConfig): void
}>()

const configStore = useConfigStore()
const { t } = useI18n()
const sidebarProps = {


    get selectedIds() {
        return configStore.selectedIds
    }
}

const sidebarEmit = (event: string, ...args: any[]) => {
    if (event === 'update:selectedIds') {
        configStore.selectedIds = args[0]
    } else if (event === 'add') {
        emit('add')
    } else if (event === 'edit') {
        emit('edit', args[0])
    }
}

const {
    showImportModal,
    importJson,
    handleDelete,
    handleShare,
    handleRefresh,
    handleImport,
    confirmImport,
} = useSidebar(sidebarProps as any, sidebarEmit as any)

const toggleSelection = (id: string) => {
    const index = configStore.selectedIds.indexOf(id)
    if (index > -1) {
        configStore.selectedIds.splice(index, 1)
    } else {
        configStore.selectedIds.push(id)
    }
}
</script>

<template>
    <div
        class="h-full flex flex-col bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
        <!-- Header Section -->
        <div
            class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:px-6 md:py-5 border-b border-gray-100 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/30">
            <div class="flex items-center gap-4">
                <div
                    class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-white dark:from-primary/20 dark:to-transparent flex items-center justify-center shadow-sm border border-primary/10">
                    <div class="i-ph-plugs-connected-bold text-2xl text-primary" />
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {{ t('home.sidebar.nodes') }}
                        </h2>
                        <span
                            class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            {{ configStore.configs.length }}
                        </span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 self-end md:self-auto">
                <button
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-all duration-300"
                    :title="t('home.refresh')" @click="handleRefresh">
                    <div class="i-ph-arrows-clockwise text-xl" />
                </button>
                <button
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-primary transition-all duration-300"
                    :title="t('home.import')" @click="handleImport">
                    <div class="i-ph-download-simple text-xl" />
                </button>
                <button
                    class="h-10 px-4 rounded-xl bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95 transition-all duration-300 flex items-center gap-2 font-bold"
                    @click="emit('add')">
                    <div class="i-ph-plus-bold text-lg" />
                    <span>{{ t('home.addNode') }}</span>
                </button>
            </div>
        </div>

        <!-- Content Section -->
        <div
            class="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <!-- Empty State -->
            <div v-if="configStore.configs.length === 0"
                class="h-full flex flex-col items-center justify-center text-center py-10">
                <div
                    class="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div class="i-ph-plugs text-5xl text-gray-300 dark:text-gray-600" />
                </div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{{ t('home.noNodes') }}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 max-w-[280px] leading-relaxed mb-8">
                    {{ t('home.nodeList.emptyDescription') }}
                </p>
                <button
                    class="h-11 px-6 rounded-2xl bg-primary text-white font-bold hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all duration-300 transform hover:-translate-y-0.5"
                    @click="emit('add')">
                    {{ t('home.createFirstNode') }}
                </button>
            </div>

            <!-- Grid Layout -->
            <div v-else class="flex flex-wrap gap-3 md:gap-4">
                <div v-for="config in configStore.configs" :key="config.id"
                    class="flex-1  min-w-[240px] relative bg-gray-100/50 dark:bg-gray-800 rounded-2xl border border-solid border-transparent transition-all duration-300 cursor-pointer overflow-hidden"
                    :class="[
                        configStore.selectedIds.includes(config.id)
                            ? 'border  border-solid border-primary'
                            : 'border-gray-100 dark:border-gray-700 hover:border-primary/50  '
                    ]" @click="toggleSelection(config.id)">

                    <div class="py-4 px-4 flex items-center justify-between relative z-10">
                        <!-- Icon -->
                        <div class="flex-shrink-0 w-14 h-14 rounded-[1.2rem] flex items-center justify-center mr-4 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                            :class="configStore.selectedIds.includes(config.id)
                                ? 'bg-primary text-white shadow-primary/30'
                                : ' bg-gray-200 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300'">
                            <div :class="getStorageIcon(config.type)" class="text-3xl" />
                        </div>

                        <!-- Text Info -->
                        <div class="flex-1 min-w-0 text-left ">
                            <h3 class="font-bold  truncate text-base leading-tight m-0 " 
                            :title="config.name"
                            :class=" configStore.selectedIds.includes(config.id)?'text-primary':'text-gray-700 dark:text-gray-100'"
                            >
                                {{ config.name }}
                            </h3>
                            <div class="flex items-center gap-2">
                                <span
                                 :class=" configStore.selectedIds.includes(config.id)?'text-primary':'text-gray-400 dark:text-gray-100'"
                                    class=" py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                    {{ config.type }}
                                </span>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div
                            class="flex items-center gap-1 flex-shrink-0   duration-300">
                            <button
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary-500 dark:hover:bg-primary/10 transition-colors"
                                @click.stop="handleShare(config)" :title="t('home.share')">
                                <div class="i-ph-share-network-bold" />
                            </button>
                            <button
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                                @click.stop="emit('edit', config)" :title="t('common.edit')">
                                <div class="i-ph-pencil-simple-bold" />
                            </button>
                            <button
                                class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                @click.stop="handleDelete(config)" :title="t('common.delete')">
                                <div class="i-ph-trash-bold" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />
    </div>
</template>

<style scoped>


/* Custom Scrollbar for this component */
.scrollbar-thin::-webkit-scrollbar {
    width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3);
    border-radius: 20px;
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(75, 85, 99, 0.4);
}
</style>
