<script setup lang="ts">

import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { COPY_FORMATS, FORMAT_LABELS } from '@/utils/common'

defineProps<{
    isBatchMode: boolean
    isAllSelected: boolean
    copyFormat: string
}>()

const emit = defineEmits<{
    (e: 'update:copyFormat', value: string): void
    (e: 'toggleBatchMode'): void
    (e: 'toggleSelectAll'): void
}>()

const { t } = useI18n()
const router = useRouter()
const themeStore = useThemeStore()

</script>


<template>
    <div class="flex justify-between mb-6 flex-col md:flex-row md:items-center gap-4">

        <div class="flex items-center gap-4">
            <button v-if="themeStore.uiMode === 'classic' || themeStore.uiMode === 'simple'"
                class="giopic-icon-btn w-10 h-10 bg-white dark:text-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:text-primary transition-all shadow-sm hover:shadow-md"
                @click="router.back()">
                <div class="i-ph-arrow-left text-xl" />
            </button>
            <div class="flex flex-col">
                <div class="text-2xl font-black italic text-gray-800 dark:text-white leading-none">{{ t('home.history.title') }}</div>
                <div class="text-xs text-gray-400 font-medium mt-1">{{ t('app.name') }} History</div>
            </div>
        </div>

        <div class="flex items-center gap-3 p-1.5 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/50">

            <div class="flex flex-row bg-white dark:bg-gray-800 rounded-lg  shadow-sm border border-gray-100 dark:border-gray-700">
                <button v-for="fmt in COPY_FORMATS" :key="fmt"
                    class="px-4 h-[32px] rounded-md text-[12px] font-bold uppercase transition-all duration-200"
                    :class="copyFormat === fmt ? 'bg-primary text-white shadow-md transform scale-105' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                    @click="emit('update:copyFormat', fmt)">
                    {{ fmt === 'markdown' ? 'MD' : FORMAT_LABELS[fmt] || fmt }}
                </button>
            </div>

            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

            <!-- Batch Actions -->
            <div class="flex items-center gap-2">
                <transition name="fade-slide" mode="out-in">
                    <button v-if="isBatchMode"
                        class="px-4 h-[32px] rounded-lg border font-bold text-xs transition-all duration-200 flex items-center gap-2"
                        :class="isAllSelected ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary'"
                        @click="emit('toggleSelectAll')">
                        <div class="i-ph-check-circle text-lg" />
                        <span class="hidden sm:inline">{{ isAllSelected ? t('home.history.deselectAll') : t('home.history.selectAll') }}</span>
                    </button>
                </transition>

                <button
                    class="px-4 h-[32px] rounded-lg border font-bold text-xs transition-all duration-200 flex items-center gap-2"
                    :class="isBatchMode ? 'bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-800 dark:border-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary'"
                    @click="emit('toggleBatchMode')">
                    <div class="i-ph-list-checks text-lg" />
                    <span class="hidden sm:inline">{{ isBatchMode ? t('home.history.cancelBatch') : t('home.history.batchManage') }}</span>
                </button>
            </div>
        </div>
    </div>
</template>


