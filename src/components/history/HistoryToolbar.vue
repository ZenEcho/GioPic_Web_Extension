<!--
 * Component Name: HistoryToolbar
 * Author: GioPic Team
 * Description: 历史记录筛选和搜索工具栏
 * 
 * Functional Domain:
 * History (历史记录) - 搜索与过滤
 * 
 * Key Features:
 * - 搜索功能：基于文件名的实时搜索
 * - 配置过滤：按上传配置筛选记录
 * - 排序控制：支持按时间正序/倒序排列
 * - 响应式布局：自适应不同屏幕宽度的控件排列
 * 
 * Props:
 * - searchQuery (string): 当前搜索关键词
 * - filterConfig (string | null): 当前选中的过滤配置 ID
 * - sortBy (string): 当前排序方式 ('date-desc' | 'date-asc')
 * - configOptions (SelectOption[]): 可用的配置过滤选项
 * - sortOptions (SelectOption[]): 可用的排序选项
 * 
 * Events:
 * - update:searchQuery: 更新搜索关键词
 * - update:filterConfig: 更新过滤配置
 * - update:sortBy: 更新排序方式
 -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SelectOption } from 'naive-ui'

defineProps<{
    searchQuery: string
    filterConfig: string | null
    sortBy: string
    configOptions: SelectOption[]
    sortOptions: SelectOption[]
}>()

const emit = defineEmits<{
    (e: 'update:searchQuery', value: string): void
    (e: 'update:filterConfig', value: string | null): void
    (e: 'update:sortBy', value: string): void
}>()

const { t } = useI18n()
</script>

<template>
    <div class="mb-6 flex flex-col md:flex-row gap-3">
        <div class="flex-1 flex gap-2">
            <n-input 
                :value="searchQuery" 
                @update:value="emit('update:searchQuery', $event)"
                :placeholder="t('home.history.searchPlaceholder')" 
                clearable 
                size="large"
                class="flex-1 rounded-xl shadow-sm border-0"
            >
                <template #prefix>
                    <div class="i-ph-magnifying-glass text-gray-400 text-lg" />
                </template>
            </n-input>
        </div>
        <div class="flex gap-3">
            <n-select 
                :value="filterConfig" 
                @update:value="emit('update:filterConfig', $event)"
                :options="configOptions" 
                clearable 
                size="large"
                :placeholder="t('home.history.filterConfig')" 
                class="w-full md:w-48" 
            />
            <n-select 
                :value="sortBy" 
                @update:value="emit('update:sortBy', $event)" 
                :options="sortOptions"
                size="large"
                class="w-full md:w-48" 
            />
        </div>
    </div>
</template>
