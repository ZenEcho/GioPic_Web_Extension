<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useThemeStore } from '@/stores/theme'
import { useMessage, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useHistoryDisplay } from '@/composables/useHistoryDisplay'
import { useBatchSelection } from '@/composables/useBatchSelection'
import HistoryHeader from '@/components/history/HistoryHeader.vue'
import HistoryToolbar from '@/components/history/HistoryToolbar.vue'
import HistoryGrid from '@/components/history/HistoryGrid.vue'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const historyStore = useHistoryStore()
const copyFormat = ref('url')

// Use Composable to manage display logic
const { history } = storeToRefs(historyStore)
const {
    searchQuery,
    filterConfig,
    sortBy,
    sortOptions,
    configOptions,
    displayList,
    sortedAndFilteredList,
    hasMore,
    loadMore
} = useHistoryDisplay(history)

// Use Composable to manage batch selection
const {
    isBatchMode,
    selectedIds,
    isAllSelected,
    hasSelected,
    toggleBatchMode,
    toggleSelection,
    toggleSelectAll,
    clearSelection
} = useBatchSelection(displayList)

function deleteSelected() {
    dialog.warning({
        title: t('common.confirm'),
        content: t('home.history.deleteSelectedConfirm', { count: selectedIds.value.size }),
        positiveText: t('common.delete'),
        negativeText: t('common.cancel'),
        onPositiveClick: () => {
            const ids = Array.from(selectedIds.value)
            historyStore.removeRecords(ids)
            clearSelection()
            message.success(t('common.success'))
        }
    })
}

// Delete filtered results
function deleteFilteredRecords() {
    const idsToDelete = sortedAndFilteredList.value.map(record => record.id)
    if (idsToDelete.length === 0) return

    dialog.warning({
        title: t('common.confirm'),
        content: t('home.history.deleteSelectedConfirm', { count: idsToDelete.length }), // Reusing message or add new one
        positiveText: t('common.delete'),
        negativeText: t('common.cancel'),
        onPositiveClick: () => {
            historyStore.removeRecords(idsToDelete)
            message.success(t('common.success'))
        }
    })
}

onMounted(() => {
    historyStore.loadHistory()
})
</script>

<template>
    <div class="bg-[#F5F7FA] dark:bg-[#101014] flex flex-col p-4 md:p-8 h-[calc(100vh-56px)] overflow-hidden">
        <!-- Header -->
        <HistoryHeader :isBatchMode="isBatchMode" :isAllSelected="isAllSelected" v-model:copyFormat="copyFormat"
            @toggleBatchMode="toggleBatchMode" @toggleSelectAll="toggleSelectAll" />

        <!-- Toolbar: Search, Sort, Filter -->
        <HistoryToolbar v-model:searchQuery="searchQuery" v-model:filterConfig="filterConfig" v-model:sortBy="sortBy"
            :configOptions="configOptions" :sortOptions="sortOptions" />

        <!-- Content -->
        <HistoryGrid :displayList="displayList" :isBatchMode="isBatchMode" :selectedIds="selectedIds"
            :copyFormat="copyFormat" :hasMore="hasMore" @toggleSelection="toggleSelection"
            @deleteRecord="historyStore.removeRecord" @loadMore="loadMore">
            <template #footer>
                <!-- Bottom Action Bar -->
                <div v-if="historyStore.history.length > 0"
                    class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 items-center">
                    <!-- Selected count text -->
                    <div v-if="isBatchMode && hasSelected" class="mr-auto text-xs font-bold text-primary">
                        {{ t('home.history.selectedCount', { count: selectedIds.size }) }}
                    </div>

                    <button v-if="isBatchMode && hasSelected" @click="deleteSelected"
                        class="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-red-500/20">
                        <div class="i-ph-trash" />
                        {{ t('home.history.deleteSelected') }}
                    </button>
                    <button v-if="displayList.length > 0 && (searchQuery || filterConfig)"
                        @click="deleteFilteredRecords"
                        class="text-xs font-medium text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                        <div class="i-ph-trash" />
                        {{ t('home.history.deleteFiltered') }}
                    </button>
                    <button @click="historyStore.clearHistory()"
                        class="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                        <div class="i-ph-broom" />
                        {{ t('home.history.clear') }}
                    </button>
                </div>
            </template>
        </HistoryGrid>
    </div>
</template>

<style scoped></style>
