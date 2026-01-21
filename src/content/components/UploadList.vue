<template>
    <Transition name="fade">
        <div v-if="isVisible" class="fixed inset-0 pointer-events-none z-[2147483646] " >
            <div ref="containerRef"
                class="absolute w-[380px] pointer-events-auto backdrop-blur-md bg-white/95 dark:bg-gray-800/95 shadow-2xl rounded-xl overflow-hidden flex flex-col font-sans text-sm border border-gray-200 dark:border-gray-700/50 transition-shadow duration-300"
                :class="{ dark: isDark }" :style="{ left: (position.x - 8) + 'px', top: position.y + 'px' }">
            <!-- Header -->
           <div ref="headerRef"
    class="px-4 py-2.5 flex justify-between items-center select-none cursor-move transition-colors duration-300
           bg-gradient-to-r from-blue-600 to-indigo-600 
           dark:from-slate-800 dark:to-slate-900 border-b dark:border-slate-700/50">
    
    <div class="flex items-center gap-2 text-white/95 dark:text-slate-200">
        <div class="i-ph-cloud-arrow-up-bold text-lg opacity-90"></div>
        <span class="font-bold tracking-wide text-sm">{{ t('uploadList.title') }}</span>
        <span class="bg-white/20 dark:bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[20px] text-center border border-white/10">
            {{ uploads.length }}
        </span>
    </div>

    <div class="flex items-center gap-1.5">
        <button @click="toggleTheme"
            class="bg-white/10 hover:bg-white/20 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 text-white/90 hover:text-white transition-all p-1.5 rounded-lg active:scale-95"
            :title="isDark ? t('settings.lightMode') : t('settings.darkMode')">
            <div v-if="isDark" class="i-ph-sun-bold text-sm"></div>
            <div v-else class="i-ph-moon-bold text-sm"></div>
        </button>

        <div class="w-px h-3 bg-white/20 dark:bg-slate-700 mx-0.5"></div>

        <select v-model="copyFormat"
            class="bg-white/10 hover:bg-white/20 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 text-white text-[10px] font-bold border-none rounded-lg outline-none cursor-pointer py-1 px-1.5 transition-colors focus:ring-1 focus:ring-white/50 dark:focus:ring-slate-500"
            :title="t('uploadList.copyFormat')">
            <option v-for="fmt in COPY_FORMATS" :key="fmt" :value="fmt"
                class="text-gray-800 dark:text-gray-200 bg-white dark:bg-slate-800">
                {{ FORMAT_LABELS[fmt] || fmt }}
            </option>
        </select>

        <button @click="clearCompleted"
            class="bg-white/10 hover:bg-white/20 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 text-white/70 hover:text-white transition-colors p-1.5 rounded-lg active:scale-95"
            :title="t('uploadList.clearCompleted')">
            <div class="i-ph-trash-bold text-sm"></div>
        </button>

        <div class="w-px h-3 bg-white/20 dark:bg-slate-700 mx-0.5"></div>

        <button @click="closeList"
            class="bg-white/10 hover:bg-white/20 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 text-white/90 hover:text-white transition-colors p-1.5 rounded-lg active:scale-95"
            :title="t('common.collapse')">
            <div class="i-ph-x-bold text-sm"></div>
        </button>
    </div>
</div>

            <!-- List -->
            <div v-if='uploads.length > 0' class="max-h-[300px] overflow-y-auto p-2 space-y-2 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/20">
                <TransitionGroup name="list">
                    <div v-for="item in uploads" :key="item.id"
                        class="group bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
                        <div class="flex items-center gap-3">
                            <!-- Thumbnail -->
                            <div
                                class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-600 relative">
                                <img v-if="item.thumbUrl" :src="item.thumbUrl" class="w-full h-full object-cover" />
                                <span v-else class="text-[10px] text-gray-400 font-medium">{{ t('uploadList.img')
                                }}</span>

                                <!-- Success Overlay -->
                                <div v-if="item.status === 'success'"
                                    class="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                    <div class="bg-green-500 rounded-full p-0.5">
                                        <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                                d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <div class="truncate font-medium text-gray-700 dark:text-gray-200 text-xs pr-2"
                                        :title="item.filename">{{ item.filename }}</div>
                                    <!-- Status Text -->
                                    <div class="flex-shrink-0 text-[10px] font-bold">
                                        <span v-if="item.status === 'success'"
                                            class="text-green-600 dark:text-green-400">{{ t('uploadList.status.done')
                                            }}</span>
                                        <span v-else-if="item.status === 'error'" class="text-red-500">{{
                                            t('uploadList.status.err') }}</span>
                                        <span v-else class="text-blue-500">{{ Math.round(item.progress) }}%</span>
                                    </div>
                                </div>
                                <div
                                    class="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5 flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full" :class="{
                                        'bg-blue-500 animate-pulse': item.status === 'uploading',
                                        'bg-green-500': item.status === 'success',
                                        'bg-red-500': item.status === 'error'
                                    }"></span>
                                    {{ item.configName }}
                                </div>
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div v-if="item.status === 'uploading'"
                            class="mt-2 w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                :style="{ width: item.progress + '%' }"></div>
                        </div>

                        <!-- Error Msg -->
                        <div v-if="item.status === 'error'"
                            class="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded truncate border border-red-100 dark:border-red-900/30">
                            {{ item.error }}
                        </div>

                        <!-- Actions -->
                        <div class="mt-2 flex justify-end gap-2">
                             <button v-if="item.status !== 'success'" @click="removeUpload(item.id)"
                                class="text-[10px] bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-200 dark:border-red-900/30 flex items-center gap-1 transition-all active:scale-95"
                                :title="t('common.delete')">
                                <div class="i-ph-trash-simple-bold text-xs"></div>
                                {{ t('common.delete') }}
                            </button>

                            <template v-if="item.status === 'success'">
                            <button @click="handleInject(item.url)"
                                class="text-[10px] bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 flex items-center gap-1 transition-all active:scale-95"
                                :title="t('common.inject')">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                {{ t('common.inject') }}
                            </button>
                            <button @click="copyToClipboard(item.url)"
                                class="text-[10px] bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 flex items-center gap-1 transition-all active:scale-95">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z">
                                    </path>
                                </svg>
                                {{ t('uploadList.copyUrl') }}
                            </button>
                            </template>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
            <!-- v-if='uploads.length > 0' -->
            <div v-else class="flex-1 flex flex-col items-center justify-center py-12 px-6 dark:bg-gray-900/20">
                <div class="w-16 h-16 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-4">
                    <div class="i-ph-cloud-slash text-gray-300 dark:text-gray-600 text-3xl"></div>
                </div>
                <div class="text-gray-400 dark:text-gray-500 font-medium text-sm">{{ t('uploadList.empty') }}</div>
                <div class="text-gray-300 dark:text-gray-600 text-[11px] mt-1 text-center">
                    {{ t('home.nodeList.emptyDescription').replace('<br>', ' ') }}
                </div>
            </div>
        </div>
    </div>
    </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import browser from 'webextension-polyfill'
import { useDraggable } from '@/content/composables/useDraggable'
import { useI18n } from 'vue-i18n'
import { formatLink, copyToClipboard as copyText, COPY_FORMATS, FORMAT_LABELS } from '@/utils/common'

const { t, locale } = useI18n()

const isDark = ref(false)
const isVisible = ref(false)

const toggleTheme = () => {
    isDark.value = !isDark.value
    browser.storage.local.set({ 'giopic-dark-mode': String(isDark.value) })
}

const closeList = () => {
    isVisible.value = false
    browser.storage.local.set({ 'giopic-show-upload-list': false })
}

// Listen to storage changes for sync with other extension parts
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes['giopic-dark-mode']) {
            isDark.value = changes['giopic-dark-mode'].newValue === 'true'
        }
        if (changes['giopic-locale']) {
            locale.value = changes['giopic-locale'].newValue as string
        }
        if (changes['giopic-show-upload-list']) {
            isVisible.value = !!changes['giopic-show-upload-list'].newValue
        }
        if (changes['giopic-upload-queue']) {
            mergeUploads(changes['giopic-upload-queue'].newValue as UploadItem[])
        }
        if (changes['giopic-upload-list-position']) {
            const newPos = changes['giopic-upload-list-position'].newValue as { x: number, y: number }
            if (newPos && !isDragging.value) {
                // Only update if not currently dragging to avoid conflict
                if (Math.abs(newPos.x - position.value.x) > 5 || Math.abs(newPos.y - position.value.y) > 5) {
                    position.value = newPos
                }
            }
        }
    }
})

interface UploadItem {
    id: string
    filename: string
    configName: string
    progress: number
    status: 'uploading' | 'success' | 'error'
    url?: string
    thumbUrl?: string
    error?: string
    timestamp: number
}

const uploads = ref<UploadItem[]>([])
const copyFormat = ref('url')

const mergeUploads = (newQueue: UploadItem[]) => {
    if (!newQueue) return
    
    // Create a map of current progress for uploading items to preserve animation
    const progressMap = new Map<string, number>()
    uploads.value.forEach(u => {
        if (u.status === 'uploading') {
            progressMap.set(u.id, u.progress)
        }
    })

    // Map new queue to preserve progress
    uploads.value = newQueue.map(item => {
        // If it's the same item and still uploading, preserve local progress
        if (item.status === 'uploading' && progressMap.has(item.id)) {
            return { ...item, progress: progressMap.get(item.id)! }
        }
        return item
    })
}

const containerRef = useTemplateRef<HTMLElement>('containerRef')
const headerRef = useTemplateRef<HTMLElement>('headerRef')

// Width is 380px, adding 20px margin from right = 400
const initialX = (document.documentElement.clientWidth || window.innerWidth) - 400
const initialY = window.innerHeight - 400

const { position, isDragging } = useDraggable(containerRef, headerRef, { x: initialX, y: initialY })

// Persist position only on drag end
watch(isDragging, (val) => {
    if (!val) {
        browser.storage.local.set({ 'giopic-upload-list-position': position.value })
    }
})

const handleMessage = (message: any) => {
    if (message.type === 'UPLOAD_EVENT') {
        const { event, id, payload } = message.data

        if (event === 'start') {
            // Auto show when upload starts
            isVisible.value = true
            browser.storage.local.set({ 'giopic-show-upload-list': true })

            // Add if not exists (though storage sync will likely handle it too)
            if (!uploads.value.find(u => u.id === id)) {
                uploads.value.unshift({
                    id,
                    filename: payload.filename,
                    configName: payload.configName,
                    progress: 0,
                    status: 'uploading',
                    thumbUrl: payload.thumbUrl,
                    timestamp: payload.timestamp || Date.now()
                })
            }
        } else if (event === 'progress') {
            const item = uploads.value.find(u => u.id === id)
            if (item) {
                item.progress = payload.progress
            }
        } else if (event === 'success') {
            const item = uploads.value.find(u => u.id === id)
            if (item) {
                item.status = 'success'
                item.progress = 100
                item.url = payload.url
            }
        } else if (event === 'fail') {
            const item = uploads.value.find(u => u.id === id)
            if (item) {
                item.status = 'error'
                item.error = payload.error
            }
        }
    }
}

const clearCompleted = () => {
    // Update storage instead of local state
    const newQueue = uploads.value.filter(u => u.status === 'uploading')
    browser.storage.local.set({ 'giopic-upload-queue': newQueue })
}

const removeUpload = (id: string) => {
    const newQueue = uploads.value.filter(u => u.id !== id)
    browser.storage.local.set({ 'giopic-upload-queue': newQueue })
}

const copyToClipboard = async (url?: string) => {
    if (!url) return
    const text = formatLink(url, copyFormat.value)
    try {
        await copyText(text)
    } catch (err) {
        // Error already logged by utility, but we catch to prevent unhandled rejection if needed
        // or we can handle UI feedback here if we add it later
    }
}

const handleInject = (url?: string) => {
    if (!url) return
    window.postMessage({
        type: 'GIOPIC_INJECT',
        url: url
    }, '*')
}

onMounted(() => {
    browser.runtime.onMessage.addListener(handleMessage)
    browser.storage.local.get(['copyFormat', 'giopic-dark-mode', 'giopic-locale', 'giopic-show-upload-list', 'giopic-upload-list-position', 'giopic-upload-queue']).then((res) => {
        if (res.copyFormat) {
            copyFormat.value = res.copyFormat as string
        }
        if (res['giopic-dark-mode']) {
            isDark.value = res['giopic-dark-mode'] === 'true'
        }
        if (res['giopic-locale']) {
            locale.value = res['giopic-locale'] as string
        }
        if (res['giopic-show-upload-list'] !== undefined) {
            isVisible.value = !!res['giopic-show-upload-list']
        }
        if (res['giopic-upload-list-position']) {
            position.value = res['giopic-upload-list-position'] as { x: number, y: number }
        }
        if (res['giopic-upload-queue']) {
            mergeUploads(res['giopic-upload-queue'] as UploadItem[])
        }
    })
})

watch(copyFormat, (val) => {
    browser.storage.local.set({ copyFormat: val })
})

onUnmounted(() => {
    browser.runtime.onMessage.removeListener(handleMessage)
})
</script>

<style scoped>
/* Scrollbar styling */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #475569;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* List Transitions */
.list-move,
.list-enter-active,
.list-leave-active {
    transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: translateX(20px);
}

.list-leave-active {
    position: absolute;
}

/* Fade Transition for main container */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>
