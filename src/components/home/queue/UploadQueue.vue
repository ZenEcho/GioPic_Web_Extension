<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import type { QueueItem } from '@/types'
import { formatLink, copyToClipboard, FORMAT_LABELS, COPY_FORMATS } from '@/utils/common'

const props = defineProps<{
    uploadQueue: QueueItem[]
}>()

const emit = defineEmits<{
    (e: 'upload-all'): void
    (e: 'clear-all'): void
    (e: 'upload-item', id: string): void
    (e: 'retry-item', id: string): void
    (e: 'remove-item', id: string): void
    (e: 'open-history'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const themeStore = useThemeStore()
const router = useRouter()

const message = useMessage()

const copyFormat = ref('url')

const hasSuccessTask = computed(() => {
    return props.uploadQueue.some(item =>
        item.tasks.some(task => task.status === 'success' && !!task.result)
    )
})

function copyLink(url: string, thumbUrl?: string) {
    const textToCopy = formatLink(url, copyFormat.value, thumbUrl)
    copyToClipboard(textToCopy).then(() => {
        message.success(t('common.copied'))
    }).catch(() => {
        message.error(t('common.copyFailed'))
    })
}
</script>

<template>
    <div
        class="flex flex-col flex-shrink-0 transition-colors duration-300 overflow-hidden bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="flex items-center justify-between p-4 md:p-6 pb-2 flex-shrink-0 gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <div class="text-lg font-black italic text-gray-800 dark:text-white truncate px-1">
                    {{ t('home.history.uploadQueue') }}
                </div>
          
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button v-if="props.uploadQueue.length > 0" @click="emit('upload-all')"
                    class="giopic-icon-btn w-8 h-8 bg-primary text-white" :title="t('home.upload.uploadAll')">
                    <div class="i-ph-upload-simple text-sm" />
                </button>
                <button v-if="props.uploadQueue.length > 0" @click="emit('clear-all')"
                    class="giopic-icon-btn w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500"
                    :title="t('home.upload.clearAll')">
                    <div class="i-ph-trash text-sm" />
                </button>
                <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button @click="emit('open-history')"
                    class="giopic-text-link text-xs font-bold text-gray-400 hover:text-primary flex items-center">
                    {{ t('home.history.title') }}
                    <div class="i-ph-arrow-right" />
                </button>
            </div>
        </div>
        <div class=" overflow-y-auto space-y-4 px-4 md:px-6 pb-4 md:pb-6 custom-scrollbar"
            :class="themeStore.uiMode != 'console' ? 'flex-col' : 'flex-row'">
                  <div v-if="hasSuccessTask" class="hidden sm:flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                    <button v-for="fmt in COPY_FORMATS" :key="fmt"
                        class="giopic-link-btn px-2 py-2 rounded text-[10px] font-bold uppercase"
                        :class="copyFormat === fmt ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'"
                        @click="copyFormat = fmt" :title="fmt">
                        {{ fmt === 'markdown' ? 'MD' : FORMAT_LABELS[fmt] || fmt }}
                    </button>
                </div>
            <!-- 正在上传的队列 -->
            <div v-for="item in props.uploadQueue" :key="item.id"
                class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 relative group">
                <div class="flex gap-3 mb-2">
                    <img :src="item.preview"
                        class="w-12 h-12 rounded-lg object-cover bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-600" />
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm truncate text-gray-700 dark:text-gray-200">{{ item.file.name
                            }}
                        </div>
                        <div class="flex items-center justify-between mt-1">
                            <div class="text-xs text-gray-400 dark:text-gray-500">
                                {{ item.status === 'pending' ? t('home.upload.status.pending') :
                                    item.status === 'processing' ? t('home.upload.status.uploading') :
                                        item.status === 'success' ? t('home.upload.status.success') :
                                            item.status === 'error' ? t('home.upload.status.error') : '' }}
                            </div>
                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button v-if="item.status === 'pending' || item.status === 'paused'"
                                    @click="emit('upload-item', item.id)"
                                    class="giopic-icon-btn p-1 text-primary hover:bg-primary/10"
                                    :title="t('home.upload.start')">
                                    <div class="i-ph-play text-xs" />
                                </button>
                                <button v-if="item.status === 'error'" @click="emit('retry-item', item.id)"
                                    class="giopic-icon-btn p-1 text-primary hover:bg-primary/10"
                                    :title="t('home.upload.retry')">
                                    <div class="i-ph-arrow-clockwise text-xs" />
                                </button>
                                <button @click="emit('remove-item', item.id)"
                                    class="giopic-icon-btn p-1 text-red-500 hover:bg-red-50"
                                    :title="t('home.upload.remove')">
                                    <div class="i-ph-x text-xs" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 进度条 / 成功 URL -->
                <div class="space-y-1">
                    <div v-for="task in item.tasks" :key="task.id"
                        class="flex items-center gap-2 text-xs min-w-0 w-full">
                        <span class="w-16 truncate text-gray-500 dark:text-gray-400">{{configStore.configs.find(c =>
                            c.id === task.configId)?.name}}</span>
                        <template v-if="task.status === 'success' && task.result">
                            <div class="flex-1 flex items-center gap-2 min-w-0">
                                <div
                                    class="text-xs text-gray-600 dark:text-gray-300 truncate font-mono select-all flex-1 min-w-0">
                                    {{ formatLink(task.result, copyFormat, item.preview) }}
                                </div>
                                <button @click="copyLink(task.result, item.preview)"
                                    class="giopic-icon-btn p-1.5 text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-600 shadow-sm"
                                    :title="t('common.copy')">
                                    <div class="i-ph-copy text-xs" />
                                </button>
                            </div>
                            <span class="w-8 text-right font-mono text-green-500">
                                OK
                            </span>
                        </template>
                        <template v-else>
                            <div class="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-300"
                                    :class="task.status === 'error' ? 'bg-red-500' : 'bg-primary'"
                                    :style="{ width: task.progress + '%' }"></div>
                            </div>
                            <span class="w-8 text-right font-mono"
                                :class="task.status === 'success' ? 'text-green-500' : ''">
                                {{ task.status === 'success' ? 'OK' : task.status === 'error' ? 'ERR' : task.progress +
                                    '%'
                                }}
                            </span>
                        </template>
                    </div>
                </div>
            </div>
            <div v-if="props.uploadQueue.length === 0"
                class="flex items-center justify-center h-20 text-gray-300 dark:text-gray-600 text-sm">
                {{ t('home.history.empty') }}
            </div>


        </div>
    </div>

</template>


<style scoped>
@media (max-width: 720px) {}

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


</style>
