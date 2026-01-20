<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import type { DriveConfig } from '@/types'
import { useI18n } from 'vue-i18n'

import AppSidebar from '@/components/home/sidebar/AppSidebar.vue'
import UploadZone from '@/components/home/upload/UploadZone.vue'
import UploadQueue from '@/components/home/queue/UploadQueue.vue'
import HistoryView from '@/views/HistoryView.vue'
import { useUploadInput } from '@/composables/useUploadInput'

const props = defineProps<{
    fileQueue: any
}>()

const emit = defineEmits<{
    (e: 'filesDropped', files: File[]): void
    (e: 'addConfig'): void
    (e: 'editConfig', config: DriveConfig): void
    (e: 'openSettings'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const currentView = ref('upload')

const isElectron = window.ipcRenderer !== undefined

// 移动端侧边栏控制
const isMobileSidebarOpen = ref(false)

const { onFilesDropped } = useUploadInput((files) => {
    emit('filesDropped', files)
})

// 移动端切换视图
function handleNavigate(view: 'upload' | 'history') {
    currentView.value = view
    isMobileSidebarOpen.value = false
}
</script>

<template>
    <div class="h-full flex flex-col md:flex-row overflow-hidden bg-[#F5F7FA] dark:bg-[#101014]">
        <!-- 移动端顶部栏 -->
        <div
            class="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
            :class="{ 'pt-12': isElectron }">
            <button class="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="isMobileSidebarOpen = true">
                <div class="i-ph-list text-xl" />
            </button>
            <div class="text-sm font-bold text-gray-700 dark:text-gray-200">
                {{ currentView === 'upload' ? t('home.nav.upload') : t('home.nav.history') }}
            </div>
            <button class="p-2 -mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="emit('openSettings')">
                <div class="i-ph-gear text-xl" />
            </button>
        </div>

        <!-- 移动端侧边栏遮罩 -->
        <Transition name="fade">
            <div v-if="isMobileSidebarOpen" class="md:hidden fixed inset-0 bg-black/50 z-40"
                @click="isMobileSidebarOpen = false" />
        </Transition>

        <!-- 侧边栏 - 桌面端固定/移动端抽屉 -->
        <Transition name="slide">
            <div v-show="isMobileSidebarOpen" class="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64">
                <AppSidebar v-model:selectedIds="configStore.selectedIds" :currentView="currentView"
                    @navigate="handleNavigate" @add="emit('addConfig')" @edit="(c) => emit('editConfig', c)"
                    @openSettings="emit('openSettings'); isMobileSidebarOpen = false" />
            </div>
        </Transition>

        <!-- 桌面端侧边栏 -->
        <div class="hidden md:block flex-shrink-0">
            <AppSidebar v-model:selectedIds="configStore.selectedIds" :currentView="currentView"
                @navigate="(view) => currentView = view" @add="emit('addConfig')" @edit="(c) => emit('editConfig', c)"
                @openSettings="emit('openSettings')" />
        </div>

        <!-- 内容区 -->
        <div class="flex-1 overflow-hidden relative" :class="{ 'md:pt-12': isElectron }">
            <!-- 上传视图: 上下分栏 -->
            <div v-if="currentView === 'upload'" class="h-full flex flex-col">
                <!-- 上部分: 上传区域 -->
                <div class="flex-none p-3 md:p-6">
                    <UploadZone @filesDropped="onFilesDropped" class="!m-0 h-full min-h-[260px] shadow-sm" />
                </div>

                <!-- 下部分: 上传队列 -->
                <div class="flex-1 min-h-0 px-3 md:px-6 py-3 md:pb-6">
                    <div
                        class="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                        <UploadQueue :uploadQueue="fileQueue.items" @upload-all="fileQueue.start()"
                            @upload-item="(id: string) => fileQueue.trigger(id)"
                            @retry-item="(id: string) => fileQueue.retry(id)"
                            @remove-item="(id: string): void => fileQueue.remove(id)" @clear-all="fileQueue.clear()"
                            @open-history="currentView = 'history'"
                            class="!m-0 !w-full !max-w-none !h-full !border-none !shadow-none !bg-transparent" />
                    </div>
                </div>
            </div>

            <!-- 历史视图 -->
            <div v-else-if="currentView === 'history'" class="h-full w-full">
                <HistoryView />
            </div>
        </div>

        <!-- 移动端底部导航栏 -->
        <div
            class="md:hidden flex-shrink-0 flex items-center justify-around bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-4 py-2 safe-area-bottom">
            <button class="flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors"
                :class="currentView === 'upload' ? 'text-primary' : 'text-gray-400'" @click="currentView = 'upload'">
                <div class="i-ph-cloud-arrow-up text-xl" />
                <span class="text-xs font-medium">{{ t('home.nav.upload') }}</span>
            </button>
            <button class="flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors"
                :class="currentView === 'history' ? 'text-primary' : 'text-gray-400'" @click="currentView = 'history'">
                <div class="i-ph-image text-xl" />
                <span class="text-xs font-medium">{{ t('home.nav.history') }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
/* 侧滑动画 */
.slide-enter-active,
.slide-leave-active {
    transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
    transform: translateX(-100%);
}

/* 遮罩动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* 安全区域适配 (iPhone 底部) */
.safe-area-bottom {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
}

/* 主题色 */
.text-primary {
    color: var(--primary-color, #ef4444);
}
</style>
