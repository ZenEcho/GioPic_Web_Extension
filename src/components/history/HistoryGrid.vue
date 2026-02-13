<!--
 * Component Name: HistoryGrid
 * Author: GioPic Team
 * Description: 历史记录网格展示组件
 * 
 * Functional Domain:
 * History (历史记录) - 核心展示区
 * 
 * Key Features:
 * - 网格布局：响应式图片网格展示
 * - 无限滚动：基于 IntersectionObserver 实现自动加载更多
 * - 批量操作：支持多选模式 (Batch Mode)
 * - 快捷操作：悬浮显示复制、注入、打开、删除按钮
 * - 图片预览：集成 Naive UI 图片预览，支持 Blob URL 处理
 * 
 * Props:
 * - displayList (UploadRecord[]): 要展示的记录列表
 * - isBatchMode (boolean): 是否处于批量选择模式
 * - selectedIds (Set<string>): 已选中的记录 ID 集合
 * - copyFormat (string): 复制链接的格式 (markdown/url/html/bbcode)
 * - hasMore (boolean): 是否还有更多数据可加载
 * 
 * Events:
 * - toggleSelection: 切换单条记录的选中状态
 * - deleteRecord: 删除单条记录
 * - loadMore: 触发加载更多数据
 -->

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import browser from 'webextension-polyfill'

import type { UploadRecord } from '@/types'
import { formatLink, copyToClipboard, COPY_FORMATS, FORMAT_LABELS } from '@/utils/common'

const props = defineProps<{
    displayList: UploadRecord[]
    isBatchMode: boolean
    selectedIds: Set<string>
    copyFormat: string
    hasMore: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleSelection', id: string): void
    (e: 'deleteRecord', id: string): void
    (e: 'loadMore'): void
    (e: 'update:copyFormat', value: string): void
}>()

const showDetail = ref(false)
const currentDetail = ref<UploadRecord | null>(null)
const currentImageInfo = ref<{ width: number; height: number } | null>(null)

const copyFormatOptions = computed(() =>
    COPY_FORMATS.map(format => ({
        label: FORMAT_LABELS[format] || format,
        value: format
    }))
)

function openDetail(record: UploadRecord) {
    currentDetail.value = record
    currentImageInfo.value = null
    showDetail.value = true
}

function handleImageLoad(e: Event) {
    const img = e.target as HTMLImageElement
    currentImageInfo.value = {
        width: img.naturalWidth,
        height: img.naturalHeight
    }
}

const { t } = useI18n()
const message = useMessage()
// Special handling for i.111666.best images


const imageBlobs = ref<Record<string, string>>({})

const fetchImageBlob = async (url: string) => {
    try {
        const response = await browser.runtime.sendMessage({
            type: 'FETCH_IMAGE_BLOB',
            url
        })
        if (response) {
            return response // response is dataUrl
        }
        throw new Error('No response')
    } catch (e) {
        console.error('Fetch image failed', e)
        throw e
    }
}

watch(() => props.displayList, (list) => {
    list.forEach(async (record) => {
        if (record.url && record.url.includes('i.111666.best') && !imageBlobs.value[record.id]) {
            try {
                const dataUrl = await fetchImageBlob(record.url)
                if (dataUrl) {
                    if (typeof dataUrl === 'string') {
                        imageBlobs.value[record.id] = dataUrl
                    }
                }
            } catch (e) {
                console.error('Failed to load blob for', record.url, e)
            }
        }
    })
}, { immediate: true, deep: true })

onUnmounted(() => {
    // No need to revoke for dataURL, but if we used createObjectURL on frontend from base64 (to save memory), we would.
    // Since we receive dataURL directly, we just let it be.
    // If memory is concern, we can nullify it.
})


// Infinite scroll logic
const loadTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const setupObserver = () => {
    if (observer) observer.disconnect()

    observer = new IntersectionObserver((entries) => {
        if (entries[0] && entries[0].isIntersecting && props.hasMore) {
            emit('loadMore')
        }
    }, {
        rootMargin: '100px',
        threshold: 0.1
    })

    if (loadTrigger.value) {
        observer.observe(loadTrigger.value)
    }
}

onMounted(() => {
    setupObserver()
})

onUnmounted(() => {
    if (observer) observer.disconnect()
})

watch(() => loadTrigger.value, () => {
    setupObserver()
})

async function handleCopy(text: string) {
    try {
        await copyToClipboard(text)
        message.success(t('common.copied'))
    } catch {
        message.error(t('common.copyFailed'))
    }
}

async function handleInject(url: string) {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true })
        if (tabs && tabs.length > 0 && tabs[0]?.id) {
            await browser.tabs.sendMessage(tabs[0].id, {
                type: 'MANUAL_INJECT',
                payload: { url }
            })
            message.success(t('common.success'))
        }
    } catch (e) {
        console.error('Injection failed', e)
        // message.error(t('common.failed'))
    }
}
</script>

<template>
    <div
        class="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-700  flex flex-col ">
        <!-- Footer Slot -->
        <slot name="clearTool" />

        <!-- List -->
        <div v-if="displayList.length > 0" class="overflow-y-auto custom-scrollbar flex-1 p-1">
            <n-image-group>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
                    <div v-for="record in displayList" :key="record.id"
                        class="group relative rounded-xl overflow-hidden transition-all duration-200 flex flex-col select-none bg-white dark:bg-gray-800/60 shadow-sm"
                        :class="[
                            isBatchMode && selectedIds.has(record.id)
                                ? 'border-2 border-primary bg-primary-50/50 dark:bg-primary-900/20 z-10 m-0'
                                : 'border border-gray-100 dark:border-gray-700 m-[1px]',
                            isBatchMode
                                ? 'cursor-pointer hover:border-primary/50 hover:bg-primary-50/30 dark:hover:bg-primary-950/10'
                                : 'hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5 hover:bg-white dark:hover:bg-gray-800/80'
                        ]" @click="isBatchMode ? emit('toggleSelection', record.id) : null">

                        <!-- Image Container -->
                        <div class="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <n-image :src="imageBlobs[record.id] || record.thumbUrl || record.url"
                                :preview-src="imageBlobs[record.id] || record.url" :preview-disabled="isBatchMode" lazy
                                object-fit="cover" class="w-full h-full flex items-center justify-center"
                                :img-props="{ class: 'w-full h-full object-cover transition-transform duration-700 group-hover:scale-110' }">
                                <template #placeholder>
                                    <div
                                        class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-300">
                                        <div class="i-ph-image text-2xl" />
                                    </div>
                                </template>
                            </n-image>

                            <!-- Selection Overlay (Batch Mode) -->
                            <div v-if="isBatchMode" class="absolute inset-0 z-10 pointer-events-none">
                                <div class="absolute inset-0 transition-colors duration-200"
                                    :class="selectedIds.has(record.id) ? 'bg-primary/20 backdrop-blur-[1px]' : 'bg-transparent group-hover:bg-black/5 dark:group-hover:bg-white/5'">
                                </div>
                                <div class="absolute top-2 left-2 w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200 shadow-sm"
                                    :class="selectedIds.has(record.id) ? 'bg-primary text-white border-primary scale-110' : 'bg-white/90 dark:bg-gray-800/90 text-gray-300 border-gray-200 dark:border-gray-700'">
                                    <div class="i-ph-check-bold text-base" />
                                </div>
                            </div>

                            <!-- Hover Actions Overlay (Normal Mode) -->
                            <div v-if="!isBatchMode"
                                class="absolute inset-0 bg-black/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 z-20">

                                <!-- Inject -->
                                <button
                                    class="w-10 h-10 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 hover:text-primary hover:scale-110 shadow-lg flex items-center justify-center transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 delay-75"
                                    :title="t('common.inject')" @click.stop="handleInject(record.url)">
                                    <div class="i-ph-magic-wand text-xl" />
                                </button>

                                <!-- Copy (Primary) -->
                                <button
                                    class="w-12 h-12 rounded-full bg-primary text-white hover:bg-primary-600 hover:scale-110 shadow-xl flex items-center justify-center transition-all duration-300 transform translate-y-4 group-hover:translate-y-0"
                                    :title="t('common.copy')"
                                    @click.stop="handleCopy(formatLink(record.url, copyFormat))">
                                    <div class="i-ph-copy text-2xl" />
                                </button>

                                <!-- Delete -->
                                <button
                                    class="w-10 h-10 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 hover:text-red-500 hover:scale-110 shadow-lg flex items-center justify-center transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 delay-100"
                                    :title="t('common.delete')" @click.stop="emit('deleteRecord', record.id)">
                                    <div class="i-ph-trash text-xl" />
                                </button>
                            </div>
                        </div>

                        <!-- Footer Info -->
                        <div class="px-3 py-2 border-t backdrop-blur-sm flex-1 flex flex-col justify-center transition-colors group/footer"
                            :class="[
                                isBatchMode && selectedIds.has(record.id)
                                    ? 'border-primary/20 bg-primary-50 dark:bg-primary-950/30'
                                    : 'bg-white/90 dark:bg-gray-800/70 border-gray-100 dark:border-gray-700 cursor-pointer group-hover:bg-gray-50/80 dark:group-hover:bg-gray-700/40'
                            ]" @click.stop="!isBatchMode ? openDetail(record) : emit('toggleSelection', record.id)">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-medium truncate flex-1 mr-2 transition-colors"
                                    :class="selectedIds.has(record.id) ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-200 group-hover/footer:text-primary'">
                                    {{ record.filename }}
                                </span>
                                <div class="i-ph-info text-gray-400 opacity-0 group-hover/footer:opacity-100 transition-opacity text-xs"
                                    v-if="!isBatchMode" />
                            </div>
                            <div class="flex items-center justify-between text-[10px] text-gray-400">
                                <div class="flex items-center gap-1 min-w-0">
                                    <div class="i-ph-cloud-arrow-up shrink-0" />
                                    <span class="truncate">{{ record.configName }}</span>
                                </div>
                                <n-time :time="record.createdAt" type="relative" class="shrink-0 ml-2" />
                            </div>
                        </div>
                    </div>
                </div>
            </n-image-group>

            <!-- Load Trigger -->
            <div ref="loadTrigger" class="h-8 w-full mt-4 flex items-center justify-center text-gray-400 text-xs">
                <span v-if="hasMore">{{ t('home.history.loading') }}</span>
                <span v-else class="opacity-50">{{ t('home.history.noMore') }}</span>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div class="i-ph-image-square text-6xl mb-4 opacity-20" />
            <p>{{ t('home.history.empty') }}</p>
        </div>

        <!-- Detail Modal -->
        <n-modal v-model:show="showDetail" preset="card" style="width: 800px; max-width: 95vw;"
            :title="t('common.details')" class="custom-modal" :bordered="false" size="huge">
            <div v-if="currentDetail" class="flex flex-col gap-6">
                <!-- Image Preview Area -->
                <div
                    class="bg-gray-100 dark:bg-gray-900/50 rounded-xl p-4 flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden relative group">
                    <img :src="imageBlobs[currentDetail.id] || currentDetail.url"
                        class="max-w-full max-h-full object-contain shadow-sm rounded-lg transition-transform duration-500 hover:scale-105"
                        @load="handleImageLoad" :alt="t('common.preview')" />
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                        class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-xs text-gray-400 mb-1">{{ t('common.filename') }}</div>
                        <div class="font-medium truncate" :title="currentDetail.filename">{{ currentDetail.filename }}
                        </div>
                    </div>
                    <div
                        class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-xs text-gray-400 mb-1">{{ t('common.uploadTime') }}</div>
                        <div class="font-medium">
                            <n-time :time="currentDetail.createdAt" type="datetime" />
                        </div>
                    </div>
                    <div
                        class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-xs text-gray-400 mb-1">{{ t('common.source') }}</div>
                        <div class="font-medium flex items-center gap-2">
                            <div class="i-ph-cloud-arrow-up text-primary" />
                            {{ currentDetail.configName }}
                        </div>
                    </div>
                    <div
                        class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-xs text-gray-400 mb-1">{{ t('common.dimensions') }}</div>
                        <div class="font-medium" v-if="currentImageInfo">
                            {{ currentImageInfo.width }} x {{ currentImageInfo.height }}
                        </div>
                        <div class="font-medium text-gray-400" v-else>-</div>
                    </div>
                </div>

                <!-- URL Section -->
                <div
                    class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div class="flex items-center justify-between gap-4 mb-3">
                        <div class="text-xs text-gray-400">{{ t('common.link') }}</div>
                        <n-select :value="copyFormat" :options="copyFormatOptions" size="small"
                            class="w-32" @update:value="emit('update:copyFormat', $event)" />
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex-1 min-w-0 bg-white dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                            <div class="font-mono text-sm truncate text-gray-600 dark:text-gray-300 select-all">
                                {{ formatLink(currentDetail.url, copyFormat) }}
                            </div>
                        </div>
                        <button
                            class="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-primary shrink-0"
                            @click="handleCopy(formatLink(currentDetail.url, copyFormat))">
                            <div class="i-ph-copy text-xl" />
                        </button>
                    </div>
                </div>
            </div>
        </n-modal>
    </div>
</template>
