<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'

const emit = defineEmits<{
    (e: 'filesDropped', files: FileList): void
}>()

const { t } = useI18n()
const themeStore = useThemeStore()
const currentHover = ref(false)

const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#ef4444')

function onDrop(e: DragEvent) {
    e.preventDefault()
    currentHover.value = false
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
        emit('filesDropped', files)
    }
}

function onDragOver(e: DragEvent) {
    e.preventDefault()
    currentHover.value = true
}

function onDragLeave(e: DragEvent) {
    e.preventDefault()
    currentHover.value = false
}

function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
        emit('filesDropped', input.files)
        input.value = ''
    }
}
</script>

<template>
    <div class="max-md:max-h-[300px] min-w-[320px] min-h-[260px] flex-1 m-4 md:m-6 bg-white dark:bg-gray-800 rounded-[32px] border-4 border-dashed relative transition-all duration-300 flex flex-col items-center justify-center overflow-hidden group"
        :class="currentHover ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[0.99]' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
        <div
            class="text-center z-10 pointer-events-none transform transition-transform duration-300 group-hover:scale-105">
            <div class="w-24 h-24 bg-primary rounded-[28px] mx-auto mb-6 flex items-center justify-center shadow-xl text-white transition-all duration-300"
                :class="currentHover ? 'animate-bounce scale-110' : 'shadow-primary/30 group-hover:shadow-primary/50 group-hover:-translate-y-2'">
                <div class="i-ph-cloud-arrow-up text-6xl" />
            </div>
            <h2 class="text-3xl font-black text-gray-800 dark:text-white mb-3 tracking-tight">{{
                t('home.dropZone.title') }}</h2>
            <p class="text-gray-400 dark:text-gray-500 font-medium text-base">{{ t('home.dropZone.subtitle') }}</p>
        </div>

        <input type="file" multiple accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer"
            @change="onFileChange" />
    </div>
</template>

<style scoped>
.border-primary {
    border-color: v-bind(primaryColor);
}

.bg-primary {
    background-color: v-bind(primaryColor);
}

.shadow-primary-500\/30 {
    --un-shadow-color: v-bind(primaryColor);
    box-shadow: 0 10px 15px -3px var(--un-shadow-color), 0 4px 6px -2px var(--un-shadow-color);
}
</style>
