<!--
 * Component Name: UploadQueue
 * Author: GioPic Team
 * Description: 上传队列与进度展示组件
 * 
 * Functional Domain:
 * Upload (上传) - 任务队列
 * 
 * Key Features:
 * - 队列管理：展示正在上传、等待中、已完成、失败的任务
 * - 任务操作：支持单个任务的重试、删除、开始
 * - 批量操作：支持全部开始、清空队列
 * - 结果处理：上传成功后展示链接，支持多种格式复制
 * - 进度展示：可视化上传进度条
 * 
 * Props:
 * - uploadQueue (QueueItem[]): 上传任务队列列表
 * 
 * Events:
 * - upload-all: 开始所有任务
 * - clear-all: 清空任务队列
 * - upload-item: 开始单个任务
 * - retry-item: 重试单个任务
 * - remove-item: 移除单个任务
 * - open-history: 跳转到历史记录页面
 -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import type { QueueItem } from '@/types'
import { formatLink, copyToClipboard, FORMAT_LABELS, COPY_FORMATS } from '@/utils/common'
import ImageEditor from './ImageEditor.vue'

const props = defineProps<{
    uploadQueue: QueueItem[]
}>()

const emit = defineEmits<{
    (e: 'upload-all'): void
    (e: 'clear-all'): void
    (e: 'upload-item', id: string): void
    (e: 'retry-item', id: string): void
    (e: 'remove-item', id: string): void
    (e: 'edit-item', id: string, payload: { file: File; preview: string }): void
    (e: 'open-history'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const themeStore = useThemeStore()
const router = useRouter()

const message = useMessage()

const copyFormat = ref('url')

// ==================== 图片编辑状态 ====================
const editorVisible = ref(false)
const editingItem = ref<QueueItem | null>(null)

/** 打开图片编辑器 */
function openEditor(item: QueueItem) {
    editingItem.value = item
    editorVisible.value = true
}

/** 关闭图片编辑器 */
function closeEditor() {
    editorVisible.value = false
    editingItem.value = null
}

/** 保存编辑结果：通知父组件替换文件和预览 */
function onEditorSave(payload: { file: File; preview: string }) {
    if (editingItem.value) {
        emit('edit-item', editingItem.value.id, payload)
    }
    closeEditor()
}

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
                class="group flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-4  border-2 border-dashed border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300">

                <!-- Header: Image and Basic Info -->
                <div class="flex gap-4">
                    <!-- Preview Image -->
                    <div
                        class="relative w-14 h-14 flex-shrink-0 group-hover:scale-105 transition-transform duration-300 ">
                        <img :src="item.preview" class="w-full h-full rounded-xl object-cover  " />
                        <!-- Status Badge -->
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px]"
                            :class="{
                                'bg-blue-500 text-white': item.status === 'processing',
                                'bg-green-500 text-white': item.status === 'success',
                                'bg-red-500 text-white': item.status === 'error',
                                'bg-gray-400 text-white': item.status === 'pending' || item.status === 'paused'
                            }">
                            <div :class="{
                                'i-ph-spinner animate-spin': item.status === 'processing',
                                'i-ph-check': item.status === 'success',
                                'i-ph-warning': item.status === 'error',
                                'i-ph-hourglass': item.status === 'pending',
                                'i-ph-pause': item.status === 'paused'
                            }" />
                        </div>
                    </div>

                    <!-- Info Body -->
                    <div class="flex-1 min-w-0 flex flex-col justify-center gap-1">
                        <div class="flex items-start justify-between gap-2">
                            <div class="font-bold text-sm text-gray-800 dark:text-gray-100 truncate leading-tight">
                                {{ item.file.name }}
                            </div>
                            <!-- Action Buttons -->
                            <div
                                class="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <!-- 编辑按钮：仅在待上传/暂停状态显示 -->
                                <button v-if="item.status === 'pending' || item.status === 'paused'"
                                    @click="openEditor(item)"
                                    class="giopic-icon-btn w-7 h-7 rounded-lg text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                                    :title="t('home.upload.edit')">
                                    <div class="i-ph-pencil-simple-bold text-sm" />
                                </button>
                                <button v-if="item.status === 'pending' || item.status === 'paused'"
                                    @click="emit('upload-item', item.id)"
                                    class="giopic-icon-btn w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    :title="t('home.upload.start')">
                                    <div class="i-ph-play-fill text-sm" />
                                </button>
                                <button v-if="item.status === 'error'" @click="emit('retry-item', item.id)"
                                    class="giopic-icon-btn w-7 h-7 rounded-lg text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                                    :title="t('home.upload.retry')">
                                    <div class="i-ph-arrow-clockwise-bold text-sm" />
                                </button>
                                <button @click="emit('remove-item', item.id)"
                                    class="giopic-icon-btn w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    :title="t('home.upload.remove')">
                                    <div class="i-ph-trash-simple-bold text-sm" />
                                </button>
                            </div>
                        </div>

                        <!-- Status Text -->
                        <div class="text-xs font-medium" :class="{
                            'text-blue-500': item.status === 'processing',
                            'text-green-500': item.status === 'success',
                            'text-red-500': item.status === 'error',
                            'text-gray-400': item.status === 'pending' || item.status === 'paused'
                        }">
                            {{ item.status === 'pending' ? t('home.upload.status.pending') :
                                item.status === 'processing' ? t('home.upload.status.uploading') :
                                    item.status === 'success' ? t('home.upload.status.success') :
                                        item.status === 'error' ? t('home.upload.status.error') : '' }}
                        </div>
                    </div>
                </div>

                <!-- Tasks List Area -->
                <div v-if="item.tasks.length > 0"
                    class="mt-4 pt-3 border-t border-gray-50 dark:border-gray-700/50 space-y-2.5">
                    <div v-for="task in item.tasks" :key="task.id" class="flex flex-col gap-3 text-xs w-full">

                        <!-- Config Name -->
                        <div class="flex-shrink-0 flex items-center gap-1.5 min-w-0">
                            <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="{
                                'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]': task.status === 'success',
                                'bg-red-500': task.status === 'error',
                                'bg-blue-500 animate-pulse': task.status === 'uploading' || task.status === 'pending'
                            }"></div>
                            <span class="truncate font-medium text-gray-500 dark:text-gray-400"
                                :title="configStore.configs.find(c => c.id === task.configId)?.name">
                                {{configStore.configs.find(c => c.id === task.configId)?.name}}
                            </span>
                        </div>

                        <!-- Progress Bar or Result Link -->
                        <div class="flex-1 min-w-0">
                            <template v-if="task.status === 'success' && task.result">
                                <div
                                    class="group/input flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg px-2.5 py-1.5 border border-gray-100 dark:border-gray-700/50 hover:border-primary/20 transition-all">
                                    <div
                                        class="flex-1 truncate font-mono text-gray-600 dark:text-gray-300 select-all text-[11px]">
                                        {{ formatLink(task.result, copyFormat, item.preview) }}
                                    </div>
                                    <div
                                        class="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 ml-1">
                                        <button @click="copyLink(task.result, item.preview)"
                                            class="p-1 rounded-md text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm"
                                            :title="t('common.copy')">
                                            <div class="i-ph-copy text-xs" />
                                        </button>
                                        <a :href="task.result" target="_blank"
                                            class="p-1 rounded-md text-gray-400 hover:text-primary hover:bg-white dark:hover:bg-gray-700 transition-all shadow-sm"
                                            :title="t('common.open')">
                                            <div class="i-ph-arrow-square-out text-xs" />
                                        </a>
                                    </div>
                                </div>
                            </template>

                            <template v-else>
                                <div class="flex items-center gap-3">
                                    <div class="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                                            :class="task.status === 'error' ? 'bg-red-500' : 'bg-primary'"
                                            :style="{ width: task.progress + '%' }">
                                            <div v-if="task.status === 'uploading'"
                                                class="absolute inset-0 bg-white/20 shimmer-effect -skew-x-12"></div>
                                        </div>
                                    </div>
                                    <span class="w-8 text-right font-mono font-bold text-[10px]"
                                        :class="task.status === 'error' ? 'text-red-500' : 'text-primary'">
                                        {{ task.status === 'error' ? 'ERR' : task.progress + '%' }}
                                    </span>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="props.uploadQueue.length === 0"
                class="flex items-center justify-center h-20 text-gray-300 dark:text-gray-600 text-sm">
                {{ t('home.history.empty') }}
            </div>


        </div>

        <!-- 图片编辑器 -->
        <ImageEditor v-if="editingItem" :visible="editorVisible" :file="editingItem.file" :preview="editingItem.preview"
            @close="closeEditor" @save="onEditorSave" />
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

@keyframes shimmer {
    0% {
        transform: translateX(-150%);
    }

    100% {
        transform: translateX(150%);
    }
}

.shimmer-effect {
    animation: shimmer 1.5s infinite linear;
}
</style>
