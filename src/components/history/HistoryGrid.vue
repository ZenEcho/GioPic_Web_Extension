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
import { ref, watch, onMounted, onUnmounted } from 'vue'

import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import browser from 'webextension-polyfill'

import type { UploadRecord } from '@/types'
import { formatLink, copyToClipboard } from '@/utils/common'

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
}>()

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
            message.success(t('common.success') || 'OK')
        }
    } catch (e) {
        console.error('Injection failed', e)
        // message.error(t('common.failed'))
    }
}
</script>

<template>
    <div class="flex-1 bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
        <!-- List -->
        <div v-if="displayList.length > 0" class="overflow-y-auto custom-scrollbar flex-1">
            <n-image-group>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start">
                    <div v-for="record in displayList" :key="record.id"
                        class="group relative bg-gray-50 dark:bg-gray-700/30 rounded-xl overflow-hidden aspect-square border border-gray-100 dark:border-gray-700 transition-all duration-300"
                        :class="isBatchMode && selectedIds.has(record.id) ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:shadow-lg hover:border-primary-200 dark:hover:border-gray-600'"
                        @click="isBatchMode ? emit('toggleSelection', record.id) : null">
                        
                        <!-- Image Container -->
                        <div class="w-full h-full relative">
                            <n-image :src="imageBlobs[record.id] || record.thumbUrl || record.url" :preview-src="imageBlobs[record.id] || record.url"
                                :preview-disabled="isBatchMode" lazy object-fit="cover"
                                class="w-full h-full flex items-center justify-center"
                                :img-props="{ class: 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105' }">
                                <template #placeholder>
                                    <div class="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-300">
                                        <div class="i-ph-image text-2xl" />
                                    </div>
                                </template>
                            </n-image>

                            <!-- Overlay Mask (Hover or Selected) -->
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                 :class="{ 'opacity-100 bg-primary/10': isBatchMode && selectedIds.has(record.id) }">
                            </div>

                            <!-- Batch Mode Checkbox (Top Left) -->
                            <div v-if="isBatchMode"
                                class="absolute top-2 left-2 z-20 transition-transform duration-200"
                                :class="selectedIds.has(record.id) ? 'scale-100' : 'scale-90 opacity-80 hover:opacity-100 hover:scale-100'"
                                @click.stop>
                                <n-checkbox size="large" :checked="selectedIds.has(record.id)"
                                    @update:checked="emit('toggleSelection', record.id)"
                                    class="bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-md border border-gray-200 dark:border-gray-600" />
                            </div>

                            <!-- Action Buttons Overlay (Center/Bottom) -->
                            <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-10 pointer-events-auto"
                                 v-if="!isBatchMode">
                                
                                <!-- Main Actions Row -->
                                <div class="flex items-center gap-2">
                                    <button
                                        class="giopic-icon-btn w-9 h-9 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 hover:text-primary hover:scale-110 shadow-lg"
                                        :title="t('common.inject')"
                                        @click.stop="handleInject(record.url)">
                                        <div class="i-ph-magic-wand text-lg" />
                                    </button>
                                    <button
                                        class="giopic-icon-btn w-9 h-9 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 hover:text-primary hover:scale-110 shadow-lg"
                                        :title="t('common.copy')"
                                        @click.stop="handleCopy(formatLink(record.url, copyFormat))">
                                        <div class="i-ph-copy text-lg" />
                                    </button>
                                </div>

                                <!-- Secondary Actions Row -->
                                <div class="flex items-center gap-2 mt-1">
                                    <a :href="record.url" target="_blank"
                                        class="giopic-icon-btn w-8 h-8 bg-white/90 dark:bg-gray-800/90 text-gray-500 dark:text-gray-400 hover:text-primary hover:scale-110 shadow-md"
                                        :title="t('common.open')"
                                        @click.stop>
                                        <div class="i-ph-arrow-square-out" />
                                    </a>
                                    <button
                                        class="giopic-icon-btn w-8 h-8 bg-white/90 dark:bg-gray-800/90 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:scale-110 shadow-md"
                                        :title="t('common.delete')"
                                        @click.stop="emit('deleteRecord', record.id)">
                                        <div class="i-ph-trash" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </n-image-group>
            
            <!-- Load Trigger -->
            <div ref="loadTrigger" class="h-8 w-full mt-4 flex items-center justify-center text-gray-400 text-xs">
                <span v-if="hasMore">{{ t('common.loading') }}</span>
                <span v-else class="opacity-50">{{ t('common.noMore') }}</span>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div class="i-ph-image-square text-6xl mb-4 opacity-20" />
            <p>{{ t('home.history.empty') }}</p>
        </div>
    </div>
</template>
