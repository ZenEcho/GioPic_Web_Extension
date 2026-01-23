<script setup lang="ts">
import { ref, computed } from 'vue'

import { useConfigStore } from '@/stores/config'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import { useUploadInput } from '@/composables/useUploadInput'
import { useSidebar } from '@/composables/useSidebar'
import type { DriveConfig } from '@/types'
import { useRouter } from 'vue-router'

import UploadZone from '@/components/home/upload/UploadZone.vue'
import UploadQueue from '@/components/home/queue/UploadQueue.vue'
import ImportConfigModal from '@/components/home/sidebar/ImportConfigModal.vue'

const props = defineProps<{
    fileQueue: any
}>()
const sidebarProps = {
    get selectedIds() {
        return configStore.selectedIds
    }
}

const emit = defineEmits<{
    (e: 'filesDropped', files: File[]): void
    (e: 'addConfig'): void
    (e: 'editConfig', config: DriveConfig): void
    (e: 'openSettings'): void
    (e: 'add'): void
    (e: 'edit', config: DriveConfig): void
}>()
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
    handleRefresh,
    handleImport,
    confirmImport,
} = useSidebar(sidebarProps as any, sidebarEmit as any)

const { t } = useI18n()
const configStore = useConfigStore()
const themeStore = useThemeStore()
const router = useRouter()

// 是否显示上传队列（当有文件时自动显示）
const showQueue = computed(() => props.fileQueue.items.length > 0)

const { onFilesDropped } = useUploadInput((files) => {
    emit('filesDropped', files)
})

</script>


<template>
    <div class="h-full w-full relative bg-[#F5F7FA] dark:bg-[#101014] overflow-hidden flex items-center justify-center">

        <!-- 背景装饰 -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px]"></div>
            <div class="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px]">
            </div>
        </div>

        <!-- 极简模式主要区域 -->
        <div class="w-full max-w-2xl px-6 relative z-10 flex flex-col items-center gap-8 transition-all duration-500"
            :class="showQueue ? '-translate-y-8' : ''">

            <!-- Logo (Minimal) -->
            <div class="flex items-center gap-2 mb-4 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                <img src="@/assets/icons/logo64.png" alt="logo" class="h-6">
                <span class="font-bold text-lg tracking-tight dark:text-gray-200">{{ t('app.name') }}</span>
            </div>

            <!-- Upload Zone (Big & Clean) -->
            <div
                class="w-full aspect-[2/1] bg-white dark:bg-gray-800 rounded-[32px] shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl">
                <UploadZone @filesDropped="onFilesDropped" class="!m-0 h-full w-full !border-none !bg-transparent" />
            </div>

            <!-- 选中的节点 (Minimal Chips) -->
            <div class="flex flex-wrap justify-center gap-2 max-w-lg">
                <div v-if="configStore.configs.length === 0" class="text-sm text-gray-400">
                    {{ t('home.noNodes') }}
                    <button @click="emit('addConfig')" class="text-primary hover:underline ml-1 font-medium">{{
                        t('home.addNode') }}</button>
                </div>
                <button v-for="config in configStore.configs" :key="config.id"
                    class="px-3 py-1 rounded-full text-xs font-medium transition-all border"
                    :class="configStore.selectedIds.includes(config.id)
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary/30'" :title="t('home.nodeTip')" @click="() => {
                            const idx = configStore.selectedIds.indexOf(config.id);
                            if (idx > -1) configStore.selectedIds.splice(idx, 1);
                            else configStore.selectedIds.push(config.id);
                        }" @contextmenu.prevent="emit('editConfig', config)" @dblclick="emit('editConfig', config)">
                    {{ config.name }}
                </button>
                <div class="flex items-center gap-2 ml-1">
                    <button v-if="configStore.selectedIds.length === 1" @click="() => {
                        const config = configStore.configs.find(c => c.id === configStore.selectedIds[0])
                        if (config) emit('editConfig', config)
                    }" class="w-6 h-6 rounded-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary hover:border-primary transition-colors"
                        :title="t('home.editNode')">
                        <div class="i-ph-pencil-simple-bold text-xs" />
                    </button>
                    <button
                        class="w-6 h-6  rounded-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary hover:border-primary transition-colors"
                        :title="t('home.refresh')" @click="handleRefresh">
                        <div class="i-ph-arrows-clockwise text-xl" />
                    </button>
                    <button @click="emit('addConfig')"
                        class="w-6 h-6  rounded-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary hover:border-primary transition-colors"
                        :title="t('home.addNode')">
                        <div class="i-ph-plus-bold text-xs" />
                    </button>
                    <button @click="handleImport"
                        class="w-6 h-6  rounded-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary hover:border-primary transition-colors"
                        :title="t('home.import')">
                        <div class="i-ph-download-simple-bold text-xs" />
                    </button>
                    <button @click="router.push('/history')"
                        class="w-6 h-6   rounded-full flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:text-primary hover:border-primary transition-colors"
                        :title="t('home.history.title')">
                        <div class="i-ph-clock-counter-clockwise text-xs" />
                    </button>
                </div>
            </div>

        </div>

        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />

        <!-- 浮动队列 (当有上传时从底部滑出) -->
        <Transition name="slide-up">
            <div v-if="showQueue"
                class="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[400px]">
                <div class="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <span class="text-xs font-bold text-gray-500 uppercase">{{ t('home.history.uploadQueue') }}</span>
                    <button @click="props.fileQueue.clear()" class="text-xs text-gray-400 hover:text-red-500">{{
                        t('home.upload.clearAll') }}</button>
                </div>
                <div class="flex-1 overflow-y-auto p-2">
                    <UploadQueue :uploadQueue="fileQueue.items" @upload-all="fileQueue.start()"
                        @upload-item="(id: string) => fileQueue.trigger(id)"
                        @retry-item="(id: string) => fileQueue.retry(id)"
                        @remove-item="(id: string): void => fileQueue.remove(id)" @clear-all="fileQueue.clear()"
                        @open-history="router.push('/history')"
                        class="!m-0 !w-full !max-w-none !h-auto !border-none !shadow-none !bg-transparent" />
                </div>
            </div>
        </Transition>

        <!-- 角落按钮 -->
        <div class="absolute top-6 right-6 flex gap-2 z-20">
            <button
                class="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-primary transition-all shadow-sm"
                @click="themeStore.toggleDark()">
                <div class="text-lg" :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
            </button>
            <button
                class="w-10 h-10 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-primary transition-all shadow-sm"
                @click="emit('openSettings')">
                <div class="i-ph-gear-six text-lg" />
            </button>
        </div>

    </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {


    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
    opacity: 0;
}
</style>
