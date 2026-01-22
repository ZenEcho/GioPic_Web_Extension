<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useThemeStore, themeColors } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import type { DriveConfig } from '@/types'
import { useUploadInput } from '@/composables/useUploadInput'

import UploadZone from '@/components/home/upload/UploadZone.vue'
import UploadQueue from '@/components/home/queue/UploadQueue.vue'
import HistoryView from '@/views/HistoryView.vue'
import NodeList from '@/components/home/node/NodeList.vue'

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
const themeStore = useThemeStore()

// 视图状态: 'upload' | 'history' | 'config'
const currentView = ref('upload')

const { onFilesDropped } = useUploadInput((files) => {
    emit('filesDropped', files)
    // 自动切换到上传视图
    if (currentView.value !== 'upload') {
        currentView.value = 'upload'
    }
})

const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#10b981')

</script>

<template>
    <div class="h-full w-full flex flex-col bg-[#F5F7FA] dark:bg-[#101014] overflow-hidden">
        <!-- 顶部导航栏 -->
        <div
            class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 h-16 flex items-center justify-between z-10">
            <!-- Logo -->
            <div class="flex items-center gap-2 font-black text-xl tracking-tighter dark:text-white">
                <div
                    class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center  shadow-sm">
                    <img src="@/assets/icons/logo64.png" alt="logo" class="h-6 hidden md:block">
                </div>
                <span class="hidden md:block">{{ t('app.name') }}</span>
            </div>

            <!-- 中间 Tabs -->
            <div class="hidden md:flex items-center bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
                <button v-for="view in ['upload', 'history', 'config']" :key="view"
                    class="px-6 py-1.5 rounded-lg text-sm font-bold transition-all duration-200" :class="currentView === view
                        ? 'bg-white dark:bg-gray-600 text-primary shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
                    @click="currentView = view">
                    {{ view === 'upload' ? t('home.sidebar.upload') : view === 'history' ? t('home.history.title') :
                        t('home.sidebar.nodes') }}
                </button>
            </div>

            <!-- 右侧操作栏 -->
            <div class="flex items-center gap-2">
                <button
                    class="giopic-icon-btn w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary transition-colors"
                    @click="themeStore.toggleDark()"
                    :title="themeStore.isDark ? t('settings.lightMode') : t('settings.darkMode')">
                    <div class="text-lg" :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
                </button>
                <button
                    class="giopic-icon-btn w-9 h-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary transition-colors"
                    @click="emit('openSettings')" :title="t('settings.title')">
                    <div class="i-ph-gear-six text-lg" />
                </button>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 custom-scrollbar">
            <div class="max-w-5xl mx-auto h-full flex flex-col">

                <!-- Upload View -->
                <div v-if="currentView === 'upload'" class="flex-1 flex flex-col gap-6 animate-fade-in-up">
                    <UploadZone @filesDropped="onFilesDropped"
                        class="flex-none min-h-[200px] md:min-h-[300px] shadow-sm rounded-2xl" />

                    <div
                        class="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                        <UploadQueue :uploadQueue="fileQueue.items" @upload-all="fileQueue.start()"
                            @upload-item="(id: string) => fileQueue.trigger(id)"
                            @retry-item="(id: string) => fileQueue.retry(id)"
                            @remove-item="(id: string): void => fileQueue.remove(id)" @clear-all="fileQueue.clear()"
                            @open-history="currentView = 'history'"
                            class="!m-0 !w-full !max-w-none !h-full !border-none !shadow-none !bg-transparent" />
                    </div>
                </div>

                <!-- History View -->

                <HistoryView v-else-if="currentView === 'history'" />


                <!-- Config View (Node Management) -->
                <NodeList v-else-if="currentView === 'config'" @add="emit('addConfig')"
                    @edit="(config) => emit('editConfig', config)" />

            </div>
        </div>

        <!-- 底部导航栏 (Mobile Only) -->
        <div
            class="md:hidden flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 h-16 flex items-center justify-around px-2 z-10 pb-safe">
            <button v-for="view in ['upload', 'history', 'config']" :key="view"
                class="flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200"
                :class="currentView === view ? 'text-primary' : 'text-gray-400 dark:text-gray-500'"
                @click="currentView = view">
                <div class="text-xl" :class="{
                    'i-ph-upload-simple': view === 'upload',
                    'i-ph-clock-counter-clockwise': view === 'history',
                    'i-ph-plugs': view === 'config'
                }" />
                <span class="text-[10px] font-bold">{{ view === 'upload' ? t('home.nav.upload') : view === 'history' ?
                    t('home.nav.history') : t('home.nav.config') }}</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.bg-primary {
    background-color: v-bind(primaryColor);
}

.text-primary {
    color: v-bind(primaryColor);
}

.border-primary {
    border-color: v-bind(primaryColor);
}

.animate-fade-in-up {
    animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>