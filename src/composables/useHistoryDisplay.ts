/**
 * @file useHistoryDisplay.ts
 * @description 历史记录展示逻辑组合式函数
 * 
 * 职责：
 * 1. 处理历史记录的展示列表生成
 * 2. 实现搜索、筛选、排序功能
 * 3. 实现分页加载逻辑
 * 
 * 依赖：
 * - vue: 响应式 API
 * - vue-i18n: 国际化
 */

import { ref, computed, watch, type Ref } from 'vue'
import type { UploadRecord } from '@/types'
import { useI18n } from 'vue-i18n'

/**
 * 历史记录展示逻辑的组合式函数
 * 处理历史记录的搜索、筛选、排序和分页
 * 
 * @param history - 完整的上传历史记录响应式数组
 */
export function useHistoryDisplay(history: Ref<UploadRecord[]>) {
    const { t } = useI18n()
    
    // 搜索关键词
    const searchQuery = ref('')
    // 选中的配置筛选项（按图床配置名筛选）
    const filterConfig = ref<string | null>(null)
    // 排序方式，默认为时间倒序
    const sortBy = ref('timeDesc')
    
    // 分页相关状态
    const page = ref(1)
    const pageSize = 24 // 每页显示的图片数量
    
    /**
     * 计算属性：排序选项列表
     */
    const sortOptions = computed(() => [
        { label: t('home.history.sortTimeDesc'), value: 'timeDesc' },
        { label: t('home.history.sortTimeAsc'), value: 'timeAsc' },
        { label: t('home.history.sortNameAsc'), value: 'nameAsc' },
        { label: t('home.history.sortNameDesc'), value: 'nameDesc' }
    ])

    /**
     * 计算属性：配置筛选选项列表
     * 从现有历史记录中提取所有不重复的配置名
     */
    const configOptions = computed(() => {
        const names = new Set(history.value.map(r => r.configName))
        return Array.from(names).map(name => ({ label: name, value: name }))
    })

    /**
     * 计算属性：经过筛选和排序的完整列表
     * 执行顺序：搜索 -> 筛选 -> 排序
     */
    const sortedAndFilteredList = computed(() => {
        let result = [...history.value]

        // 搜索过滤
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            result = result.filter(r => r.filename.toLowerCase().includes(query))
        }

        // 配置名过滤
        if (filterConfig.value) {
            result = result.filter(r => r.configName === filterConfig.value)
        }

        // 排序
        result.sort((a, b) => {
            switch (sortBy.value) {
                case 'timeAsc': return a.createdAt - b.createdAt
                case 'timeDesc': return b.createdAt - a.createdAt
                case 'nameAsc': return a.filename.localeCompare(b.filename)
                case 'nameDesc': return b.filename.localeCompare(a.filename)
                default: return 0
            }
        })

        return result
    })

    /**
     * 计算属性：当前页展示的列表（分页后）
     * 基于 sortedAndFilteredList 进行切片
     */
    const displayList = computed(() => {
        return sortedAndFilteredList.value.slice(0, page.value * pageSize)
    })
    
    /**
     * 计算属性：是否还有更多数据可加载
     */
    const hasMore = computed(() => {
        return displayList.value.length < sortedAndFilteredList.value.length
    })

    /**
     * 加载更多数据（下一页）
     */
    function loadMore() {
        if (hasMore.value) {
            page.value++
        }
    }

    // 当筛选条件变化时，重置分页到第一页
    watch([searchQuery, filterConfig, sortBy], () => {
        page.value = 1
    })
    
    // 当原始数据变化时（如删除记录），重置分页
    watch(history, () => {
        page.value = 1
    })

    return {
        searchQuery,
        filterConfig,
        sortBy,
        sortOptions,
        configOptions,
        displayList,
        sortedAndFilteredList,
        hasMore,
        loadMore
    }
}
