<!--
 * Component Name: DriveSelector
 * Author: GioPic Team
 * Description: 图床驱动选择器组件，用于展示和选择可用的图床类型。
 * 
 * Functional Domain:
 * Config (配置模块) - 提供分类（自托管、云存储、公共图床）的驱动选择界面
 * 
 * Key Features:
 * - 分类展示：按预定义类别（自托管、云存储等）分组展示图床
 * - 实时搜索：支持按名称或类型代码模糊搜索
 * - 动态元数据：从 Registry 动态获取图标和颜色
 * - 插件集成：支持展示通过插件系统注册的图床
 * 
 * Props:
 * - modelValue (string): 当前选中的图床类型代码
 * 
 * Events:
 * - update:modelValue: 更新选中值
 * - select: 选择图床时触发
 -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DriveCategory } from '@/constants/driveSchemas'
import { useDriveRegistry } from '@/composables/useDriveRegistry'
import PluginManagerModal from '@/components/settings/PluginManagerModal.vue'

// 定义组件 Props
const props = defineProps<{
    modelValue?: string
}>()

// 定义组件 Events
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'select', value: string): void
}>()

const { t } = useI18n()
// 使用组合式函数获取图床注册表和元数据获取器
const { registry, getDriveMeta: getMeta } = useDriveRegistry()
const searchQuery = ref('')
const showPluginManager = ref(false)

// 类别定义 (顺序和标题)
const CATEGORY_DEFINITIONS: { id: DriveCategory, title: string }[] = [
  { id: 'self-hosted', title: 'config.categories.selfHosted' }, // 自托管
  { id: 'cloud', title: 'config.categories.cloud' },           // 云存储
  { id: 'public', title: 'config.categories.public' },         // 公共图床
  { id: 'custom', title: 'config.categories.custom' },         // 自定义
  { id: 'plugin', title: 'config.categories.plugin' }          // 插件
]

// 根据 Registry 动态生成分类列表
const driveCategories = computed(() => {
    return CATEGORY_DEFINITIONS.map(cat => ({
      ...cat,
      types: Object.values(registry.value)
        .filter(item => item.category === cat.id)
        .map(item => item.key)
    }))
})

// 获取图床类型的显示名称
function getDriveLabel(value: string) {
    const item = registry.value[value]
    if (!item) return value
    
    // 如果是插件，直接使用 label (通常没有 i18n)
    if (item.category === 'plugin') {
        return item.label
    }
    
    // 原生图床尝试获取翻译
    const i18nKey = `providers.${value}`
    const translated = t(i18nKey)
    if (translated !== i18nKey) return translated
    
    return item.label
}

// 获取图床元数据 (图标、颜色)
function getDriveMeta(type: string) {
    const item = getMeta(type)
    if (!item) {
        // 默认元数据
        return {
             color: 'text-gray-600 bg-gray-100',
             darkColor: 'dark:text-gray-300 dark:bg-gray-800',
             icon: 'i-ph-hard-drive-duotone'
        }
    }
    
    return {
        color: item.color,
        darkColor: item.darkColor,
        icon: item.icon
    }
}

// 基于搜索关键词过滤分类
const filteredCategories = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    const categories = driveCategories.value
    
    if (!query) {
        return categories
    }
    
    return categories.map(category => {
        const filteredTypes = category.types.filter(type => {
            const label = getDriveLabel(type).toLowerCase()
            // 同时搜索类型代码和显示名称
            return type.toLowerCase().includes(query) || label.includes(query)
        })
        
        if (filteredTypes.length > 0) {
            return {
                ...category,
                types: filteredTypes
            }
        }
        return null
    }).filter(Boolean) as typeof categories
})

// 处理图床选择
function handleSelect(type: string) {
    emit('update:modelValue', type)
    emit('select', type)
}
</script>

<template>
    <div class="flex flex-col h-[550px] bg-gray-50/50 dark:bg-gray-900/50">
        <PluginManagerModal v-model:show="showPluginManager" class="z-[100]" />
        <!-- 顶部搜索栏 -->
        <div class="sticky top-0 z-10 p-4 sm:p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
            <div class="max-w-xl mx-auto flex items-center gap-2 sm:gap-3">
                <div class="relative flex-1 group">
                    <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none transition-colors duration-300 group-focus-within:text-primary text-gray-400">
                        <div class="i-ph-magnifying-glass-duotone text-lg sm:text-xl"></div>
                    </div>
                    <input 
                        v-model="searchQuery"
                        type="text" 
                        class="block w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-transparent bg-gray-100 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 rounded-xl sm:rounded-2xl placeholder-gray-400 transition-all duration-300 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-primary-20 focus:shadow-lg focus:shadow-primary-5 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm"
                        :placeholder="t('config.searchPlaceholder', 'Search drive type...')"
                    >
                    <!-- 清除搜索按钮 -->
                    <div v-if="searchQuery" 
                        class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        @click="searchQuery = ''">
                        <div class="i-ph-x-circle-fill text-lg"></div>
                    </div>
                </div>
                <!-- 插件管理按钮 -->
                <button 
                    class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-gray-900/50  dark:hover:bg-gray-800 border-2 border-transparent hover:border-primary-20 hover:text-primary -primary-5 transition-all duration-300 text-gray-500 shrink-0"
                    :title="t('settings.plugins.title')"
                    @click="showPluginManager = true"
                >
                    <div class="i-ph-puzzle-piece-duotone text-lg sm:text-xl"></div>
                </button>
            </div>
        </div>

        <!-- 分类列表内容 -->
        <div class="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
            <div class="max-w-5xl mx-auto space-y-10">
                <!-- 无搜索结果提示 -->
                <div v-if="filteredCategories.length === 0" class="flex flex-col items-center justify-center py-20 animate-fade-in">
                    <div class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                        <div class="i-ph-magnifying-glass-duotone text-5xl text-gray-300 dark:text-gray-600"></div>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{{ t('config.noResults') }}</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">{{ t('config.noResultsDesc', 'Try adjusting your search terms') }}</p>
                </div>

                <!-- 分类区块 -->
                <div v-for="(category, idx) in filteredCategories" :key="category.id" 
                    class="animate-fade-in"
                    :style="{ animationDelay: `${idx * 100}ms` }"
                >
                    <!-- 分类标题 -->
                    <div class="flex items-center gap-3 mb-5 px-1">
                        <h3 class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t(category.title, category.title) }}</h3>
                        <div class="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent"></div>
                    </div>
                    
                    <!-- 图床卡片网格 -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div v-for="type in category.types" :key="type"
                            class="group relative cursor-pointer mt-2 "
                            @click="handleSelect(type)"
                        >
                            <div class="relative flex flex-col p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-primary-5 group-hover:border-primary-20 group-hover:bg-primary-5"
                                :class="{ 'active-card': modelValue === type }"
                            >
                                <!-- 图标头部 -->
                                <div class="flex items-start justify-between mb-3">
                                    <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
                                        :class="[getDriveMeta(type).color, getDriveMeta(type).darkColor]"
                                    >
                                        <div v-if="!getDriveMeta(type).icon.startsWith('http')" :class="getDriveMeta(type).icon"></div>
                                        <img v-else :src="getDriveMeta(type).icon" class="w-8 h-8 object-contain" alt="icon" />
                                    </div>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 -mr-1 -mt-1">
                                        <div class="i-ph-arrow-right text-primary text-xl"></div>
                                    </div>
                                </div>

                                <!-- 文本内容 -->
                                <div>
                                    <h4 class="font-bold text-gray-900 dark:text-gray-100 text-sm mb-0.5 group-hover:text-primary transition-colors">
                                        {{ getDriveLabel(type) }}
                                    </h4>
                                    <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                        {{ type }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.text-primary {
    color: var(--primary-color) !important;
}

.group:hover .group-hover\:text-primary {
    color: var(--primary-color) !important;
}

.group-focus-within\:text-primary:focus-within {
    color: var(--primary-color) !important;
}

.focus\:border-primary-20:focus {
    border-color: color-mix(in srgb, var(--primary-color), transparent 80%) !important;
}

.focus\:shadow-primary-5:focus {
    --tw-shadow-color: color-mix(in srgb, var(--primary-color), transparent 95%);
}

/* Backgrounds - Mixed with base color to prevent transparency issues */
.bg-primary-5,
.active-card,
.group:hover .group-hover\:bg-primary-5 {
    background-color: color-mix(in srgb, var(--primary-color), white 95%) !important;
}

:global(.dark) .bg-primary-5,
:global(.dark) .active-card,
:global(.dark) .group:hover .group-hover\:bg-primary-5 {
    background-color: color-mix(in srgb, var(--primary-color), #1f2937 95%) !important;
}

.group:hover .group-hover\:shadow-primary-5 {
    --tw-shadow-color: color-mix(in srgb, var(--primary-color), transparent 95%);
}

.group:hover .group-hover\:border-primary-20 {
    border-color: color-mix(in srgb, var(--primary-color), transparent 80%) !important;
}

.active-card {
    border-color: var(--primary-color) !important;
    /* background-color handled by shared rule above */
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color), transparent 80%) !important;
}

.animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.3); /* gray-400/30 */
    border-radius: 6px;
    border: 2px solid transparent;
    background-clip: content-box;
    transition: background-color 0.2s;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5); /* gray-400/50 */
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(107, 114, 128, 0.8); /* gray-500/80 */
}

/* Dark mode scrollbar */
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.2); /* gray-400/20 */
}

:global(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.4); /* gray-400/40 */
}

:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.6); /* gray-400/60 */
}
</style>
