/**
 * @file useBatchSelection.ts
 * @description 批量选择逻辑组合式函数
 * 
 * 职责：
 * 1. 提供列表项的批量选择、全选、反选、清空功能
 * 2. 管理批量操作模式的状态
 * 
 * 依赖：
 * - vue: 响应式 API
 */

import { ref, computed, type Ref } from 'vue'

/**
 * 批量选择逻辑的组合式函数
 * 提供批量模式切换、单选、全选、清空选择等功能
 * 
 * @param items - 包含可选项目的响应式数组引用
 */
export function useBatchSelection(items: Ref<any[]>) {
    // 是否处于批量操作模式
    const isBatchMode = ref(false)
    // 已选中的项目 ID 集合
    const selectedIds = ref<Set<string>>(new Set())

    /**
     * 计算属性：是否已选中所有项目
     * 当列表非空且选中数量等于列表长度时返回 true
     */
    const isAllSelected = computed(() => {
        return items.value.length > 0 && selectedIds.value.size === items.value.length
    })

    /**
     * 计算属性：是否有选中的项目
     */
    const hasSelected = computed(() => selectedIds.value.size > 0)

    /**
     * 切换批量模式状态
     * 退出批量模式时会自动清空已选集合
     */
    function toggleBatchMode() {
        isBatchMode.value = !isBatchMode.value
        if (!isBatchMode.value) {
            selectedIds.value = new Set()
        }
    }

    /**
     * 切换单个项目的选中状态
     * 仅在批量模式下有效
     * 
     * @param id - 项目的唯一标识符
     */
    function toggleSelection(id: string) {
        if (!isBatchMode.value) return
        const newSet = new Set(selectedIds.value)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        selectedIds.value = newSet
    }

    /**
     * 切换全选/取消全选状态
     * 如果已全选则清空，否则选中所有项目
     */
    function toggleSelectAll() {
        if (isAllSelected.value) {
            selectedIds.value = new Set()
        } else {
            selectedIds.value = new Set(items.value.map(record => record.id))
        }
    }
    
    /**
     * 清空所有已选项目
     */
    function clearSelection() {
        selectedIds.value = new Set()
    }

    return {
        isBatchMode,
        selectedIds,
        isAllSelected,
        hasSelected,
        toggleBatchMode,
        toggleSelection,
        toggleSelectAll,
        clearSelection
    }
}
