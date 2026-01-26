<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DRIVE_TYPE_OPTIONS } from '@/constants/driveSchemas'
import { getStorageIcon } from '@/utils/icon'

const props = defineProps<{
    modelValue?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'select', value: string): void
}>()

const { t } = useI18n()
const searchQuery = ref('')

// Drive Categories Definition
const DRIVE_CATEGORIES = [
  {
    id: 'self-hosted',
    title: 'config.categories.selfHosted',
    types: ['lsky', 'easyimages', 'chevereto', 'imgurl', 'zpic', 'hellohao']
  },
  {
    id: 'cloud',
    title: 'config.categories.cloud',
    types: ['aliyun', 'tencent', 'aws']
  },
  {
    id: 'public',
    title: 'config.categories.public',
    types: ['smms', 'imgur', 'github']
  },
  {
    id: 'custom',
    title: 'config.categories.custom',
    types: ['custom']
  }
]

const DRIVE_META: Record<string, { color: string, darkColor?: string }> = {
    // Self-hosted
    lsky: { color: 'text-blue-600 bg-blue-100', darkColor: 'dark:text-blue-300 dark:bg-blue-900/30' },
    easyimages: { color: 'text-green-600 bg-green-100', darkColor: 'dark:text-green-300 dark:bg-green-900/30' },
    chevereto: { color: 'text-orange-600 bg-orange-100', darkColor: 'dark:text-orange-300 dark:bg-orange-900/30' },
    imgurl: { color: 'text-purple-600 bg-purple-100', darkColor: 'dark:text-purple-300 dark:bg-purple-900/30' },
    zpic: { color: 'text-pink-600 bg-pink-100', darkColor: 'dark:text-pink-300 dark:bg-pink-900/30' },
    hellohao: { color: 'text-indigo-600 bg-indigo-100', darkColor: 'dark:text-indigo-300 dark:bg-indigo-900/30' },
    
    // Cloud
    aliyun: { color: 'text-orange-600 bg-orange-100', darkColor: 'dark:text-orange-300 dark:bg-orange-900/30' },
    tencent: { color: 'text-blue-600 bg-blue-100', darkColor: 'dark:text-blue-300 dark:bg-blue-900/30' },
    aws: { color: 'text-yellow-600 bg-yellow-100', darkColor: 'dark:text-yellow-300 dark:bg-yellow-900/30' },
    
    // Public
    smms: { color: 'text-blue-500 bg-blue-50', darkColor: 'dark:text-blue-300 dark:bg-blue-900/30' },
    imgur: { color: 'text-green-500 bg-green-50', darkColor: 'dark:text-green-300 dark:bg-green-900/30' },
    github: { color: 'text-gray-700 bg-gray-200', darkColor: 'dark:text-gray-300 dark:bg-gray-700' },
    
    // Custom
    custom: { color: 'text-gray-600 bg-gray-100', darkColor: 'dark:text-gray-300 dark:bg-gray-800' }
}

function getDriveLabel(value: string) {
    const option = DRIVE_TYPE_OPTIONS.find(opt => opt.value === value)
    return option ? option.label : value
}

function getDriveMeta(type: string) {
    const meta = DRIVE_META[type] || { 
        color: 'text-gray-600 bg-gray-100', 
        darkColor: 'dark:text-gray-300 dark:bg-gray-800'
    }
    
    return {
        ...meta,
        icon: getStorageIcon(type)
    }
}

// Filtered categories based on search query
const filteredCategories = computed(() => {
    const query = searchQuery.value.toLowerCase().trim()
    
    if (!query) {
        return DRIVE_CATEGORIES
    }
    
    return DRIVE_CATEGORIES.map(category => {
        const filteredTypes = category.types.filter(type => {
            const label = getDriveLabel(type).toLowerCase()
            return type.toLowerCase().includes(query) || label.includes(query)
        })
        
        if (filteredTypes.length > 0) {
            return {
                ...category,
                types: filteredTypes
            }
        }
        return null
    }).filter(Boolean) as typeof DRIVE_CATEGORIES
})

function handleSelect(type: string) {
    emit('update:modelValue', type)
    emit('select', type)
}
</script>

<template>
    <div class="flex flex-col h-[550px] bg-gray-50/50 dark:bg-gray-900/50">
        <!-- Search Bar Header -->
        <div class="sticky top-0 z-10 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-700">
            <div class="relative max-w-xl mx-auto group">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors duration-300 group-focus-within:text-primary text-gray-400">
                    <div class="i-ph-magnifying-glass-duotone text-xl"></div>
                </div>
                <input 
                    v-model="searchQuery"
                    type="text" 
                    class="block w-full pl-12 pr-4 py-3 border-2 border-transparent bg-gray-100 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 rounded-2xl placeholder-gray-400 transition-all duration-300 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:border-primary-20 focus:shadow-lg focus:shadow-primary-5 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm"
                    :placeholder="t('config.searchPlaceholder', 'Search drive type...')"
                >
                <div v-if="searchQuery" 
                    class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    @click="searchQuery = ''">
                    <div class="i-ph-x-circle-fill text-lg"></div>
                </div>
            </div>
        </div>

        <!-- Categories Content -->
        <div class="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
            <div class="max-w-5xl mx-auto space-y-10">
                <!-- No Results -->
                <div v-if="filteredCategories.length === 0" class="flex flex-col items-center justify-center py-20 animate-fade-in">
                    <div class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                        <div class="i-ph-magnifying-glass-duotone text-5xl text-gray-300 dark:text-gray-600"></div>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{{ t('config.noResults') }}</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">{{ t('config.noResultsDesc', 'Try adjusting your search terms') }}</p>
                </div>

                <!-- Category Sections -->
                <div v-for="(category, idx) in filteredCategories" :key="category.id" 
                    class="animate-fade-in"
                    :style="{ animationDelay: `${idx * 100}ms` }"
                >
                    <div class="flex items-center gap-3 mb-5 px-1">
                        <h3 class="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t(category.title, category.title) }}</h3>
                        <div class="h-px flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent"></div>
                    </div>
                    
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div v-for="type in category.types" :key="type"
                            class="group relative cursor-pointer mt-2 "
                            @click="handleSelect(type)"
                        >
                            <div class="relative flex flex-col p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-primary-5 group-hover:border-primary-20 group-hover:bg-primary-5"
                                :class="{ 'active-card': modelValue === type }"
                            >
                                <!-- Icon Header -->
                                <div class="flex items-start justify-between mb-3">
                                    <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm"
                                        :class="[getDriveMeta(type).color, getDriveMeta(type).darkColor]"
                                    >
                                        <div :class="getDriveMeta(type).icon"></div>
                                    </div>
                                    <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 -mr-1 -mt-1">
                                        <div class="i-ph-arrow-right text-primary text-xl"></div>
                                    </div>
                                </div>

                                <!-- Text Content -->
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
