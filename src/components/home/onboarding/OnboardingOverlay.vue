<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'
import confetti from 'canvas-confetti'

const props = defineProps<{
    show: boolean
}>()

const emit = defineEmits<{
    (e: 'complete'): void
    (e: 'create-node'): void
    (e: 'import-node'): void
}>()

const themeStore = useThemeStore()
const { t, locale } = useI18n()

// 内部状态
const isOnboardingMinimized = ref(false)
const onboardingStep = ref<'language' | 'layout' | 'config'>('language')
const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#ef4444')
// 方法
function handleLanguageSelect(lang: string) {
    locale.value = lang
    browser.storage.local.set({ 'giopic-language': lang })
    onboardingStep.value = 'config'
}

function celebrate() {
    // 播放礼花特效
    const duration = 2000
    const end = Date.now() + duration

    ;(function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            zIndex: 2147483647
        })
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            zIndex: 2147483647
        })

        if (Date.now() < end) {
            requestAnimationFrame(frame)
        }
    })()
}

function handleComplete() {
    celebrate()
    emit('complete')
}

// 暴露给父组件的方法，用于在外部触发最小化（例如去配置节点前）
function minimize() {
    isOnboardingMinimized.value = true
}

// 暴露给父组件，重置状态（如果需要）
function reset() {
    onboardingStep.value = 'language'
    isOnboardingMinimized.value = false
}

// 暴露给父组件，恢复显示（取消最小化）
function restore() {
    isOnboardingMinimized.value = false
}

defineExpose({
    minimize,
    reset,
    restore,
    celebrate
})
</script>

<template>
    <Transition name="fade">
        <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center"
            :class="isOnboardingMinimized ? 'pointer-events-none' : ''">

            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                :class="isOnboardingMinimized ? 'opacity-0' : 'opacity-100'" />

            <!-- Main Card -->
            <div class="relative w-[800px] max-w-[90vw] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 transform"
                :class="isOnboardingMinimized ? 'translate-y-[120%] scale-90 opacity-0' : 'translate-y-0 scale-100 opacity-100'">
                <div class="p-8 md:p-12">
                    <!-- Close/Skip Button -->
                    <div class="absolute top-6 right-6 flex items-center gap-2">
                        <button class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors font-medium"
                            @click="handleComplete">
                            {{ t('home.onboarding.config.skip') }}
                        </button>
                    </div>

                    <!-- Step 1: Language Selection -->
                    <div v-if="onboardingStep === 'language'" class="animate-fade-in">
                        <div class="text-center mb-10">
                            <div
                                class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <div class="i-ph-translate text-3xl text-primary" />
                            </div>
                            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Select Language /
                                选择语言</h2>
                            <p class="text-gray-500 dark:text-gray-400">Please select your preferred language</p>
                        </div>

                        <div class="grid grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
                            <div class="relative group cursor-pointer rounded-2xl border-2 transition-all duration-300 p-8 hover:shadow-xl flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-700/30"
                                :class="locale === 'en-US' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'"
                                @click="handleLanguageSelect('en-US')">
                                <div class="text-5xl mb-2">🇺🇸</div>
                                <div class="font-bold text-xl text-gray-800 dark:text-gray-200">English</div>
                                <div class="text-sm text-gray-400">English</div>
                                <div v-if="locale === 'en-US'" class="absolute top-4 right-4 text-primary text-2xl">
                                    <div class="i-ph-check-circle-fill"></div>
                                </div>
                            </div>
                            <div class="relative group cursor-pointer rounded-2xl border-2 transition-all duration-300 p-8 hover:shadow-xl flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-700/30"
                                :class="locale === 'zh-CN' ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'"
                                @click="handleLanguageSelect('zh-CN')">
                                <div class="text-5xl mb-2">🇨🇳</div>
                                <div class="font-bold text-xl text-gray-800 dark:text-gray-200">简体中文</div>
                                <div class="text-sm text-gray-400">Chinese</div>
                                <div v-if="locale === 'zh-CN'" class="absolute top-4 right-4 text-primary text-2xl">
                                    <div class="i-ph-check-circle-fill"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: Removed -->

                    <!-- Step 3: Config Selection -->
                    <div v-else-if="onboardingStep === 'config'" class="animate-fade-in">
                        <div class="text-center mb-8">
                            <div
                                class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <div class="i-ph-plugs-connected text-3xl text-primary" />
                            </div>
                            <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{{
                                t('home.onboarding.config.title')
                                }}</h2>
                            <p class="text-gray-500 dark:text-gray-400">{{ t('home.onboarding.config.subtitle') }}
                            </p>
                        </div>

                        <div class="grid grid-cols-1 gap-4 mb-8 max-w-md mx-auto">
                            <!-- Create New -->
                            <div class="relative group cursor-pointer rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary/50 transition-all duration-300 p-4 hover:shadow-lg flex items-center gap-4"
                                @click="emit('create-node')">
                                <div
                                    class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl text-primary">
                                    <div class="i-ph-plus-bold" />
                                </div>
                                <div class="flex-1">
                                    <div class="font-bold text-gray-800 dark:text-gray-200">{{
                                        t('home.onboarding.config.create') }}</div>
                                    <div class="text-xs text-gray-500">{{ t('home.onboarding.config.createDesc') }}
                                    </div>
                                </div>
                                <div class="i-ph-caret-right text-gray-400" />
                            </div>

                            <!-- Import -->
                            <div class="relative group cursor-pointer rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-primary/50 transition-all duration-300 p-4 hover:shadow-lg flex items-center gap-4"
                                @click="emit('import-node')">
                                <div
                                    class="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-2xl text-blue-500">
                                    <div class="i-ph-download-simple-bold" />
                                </div>
                                <div class="flex-1">
                                    <div class="font-bold text-gray-800 dark:text-gray-200">{{
                                        t('home.onboarding.config.import') }}</div>
                                    <div class="text-xs text-gray-500">{{ t('home.onboarding.config.importDesc') }}
                                    </div>
                                </div>
                                <div class="i-ph-caret-right text-gray-400" />
                            </div>

                            <!-- Configure Later -->
                            <div class="relative group cursor-pointer rounded-xl border-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 p-4 flex items-center gap-4"
                                @click="handleComplete">
                                <div
                                    class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl text-gray-500">
                                    <div class="i-ph-clock" />
                                </div>
                                <div class="flex-1">
                                    <div class="font-bold text-gray-800 dark:text-gray-200">{{
                                        t('home.onboarding.config.later') }}</div>
                                    <div class="text-xs text-gray-500">{{ t('home.onboarding.config.laterDesc') }}
                                    </div>
                                </div>
                                <div class="i-ph-caret-right text-gray-400" />
                            </div>
                        </div>

                        <div class="flex justify-center">
                            <button
                                class="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 rounded-xl font-bold transition-all"
                                @click="onboardingStep = 'language'">
                                <div class="i-ph-arrow-left inline-block mr-1 align-middle" />
                                {{ t('common.back', 'Back') }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Minimized Control Bar -->
            <div class=" min-w-[360px] absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-full shadow-2xl p-2 px-4 flex items-center gap-4 transition-all duration-500 pointer-events-auto"
                :class="isOnboardingMinimized ? 'translate-y-0 opacity-100' : 'translate-y-[200%] opacity-0'">
                <div class="flex items-center gap-2 pr-4 border-r border-gray-200 dark:border-gray-700">
                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <div class="i-ph-terminal-window"></div>
                    </div>
                    <span class="font-bold text-gray-700 dark:text-gray-200">GioPic</span>
                </div>
                <button
                    class="px-4 py-2  hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
                    @click="isOnboardingMinimized = false">
                    {{ t('home.onboarding.restore') }}
                </button>
                <button
                    class="px-6 py-2  bg-primary hover:bg-primary-hover text-white rounded-full text-sm font-bold shadow-lg shadow-primary/20 transition-all"
                    @click="handleComplete">
                    {{ t('home.onboarding.start') }}
                </button>
            </div>
        </div>
    </Transition>
</template>
<style scoped>
.bg-primary {
    background-color: v-bind(primaryColor);
}

.bg-primary\/5 {
    background-color: color-mix(in srgb, v-bind(primaryColor) 5%, transparent);
}

.bg-primary\/10 {
    background-color: color-mix(in srgb, v-bind(primaryColor) 10%, transparent);
}

.bg-primary\/20 {
    background-color: color-mix(in srgb, v-bind(primaryColor) 20%, transparent);
}

.border-primary {
    border-color: v-bind(primaryColor);
}

.border-primary\/50 {
    border-color: color-mix(in srgb, v-bind(primaryColor) 50%, transparent);
}

.text-primary {
    color: v-bind(primaryColor);
}

.shadow-primary\/20 {
    box-shadow: 0 10px 15px -3px color-mix(in srgb, v-bind(primaryColor) 20%, transparent);
}

.hover\:bg-primary-hover:hover {
    background-color: color-mix(in srgb, v-bind(primaryColor) 90%, black);
}
</style>