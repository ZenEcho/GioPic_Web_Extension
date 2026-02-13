<!--
 * Component Name: FloatingBallSettings
 * Author: GioPic Team
 * Description: 悬浮球偏好设置组件，用于控制 Content Script 中悬浮球的行为和外观。
 * 
 * Functional Domain:
 * Settings (全局设置) - 悬浮球偏好
 * 
 * Key Features:
 * - 开关控制：全局启用/禁用悬浮球
 * - 模式选择：注入模式 (Shadow DOM) vs 原生模式
 * - 外观定制：透明度调节
 * - 位置记忆：自动保存悬浮球位置
 * 
 * Props:
 * - show (boolean): 模态框显示状态
 * 
 * Events:
 * - update:show: 更新显示状态
 * - save: 保存设置时触发
 -->
<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" class="w-full max-w-[480px]"
        preset="card" :title="t('settings.floatingBall.title')" :bordered="false" :segmented="{ content: 'soft' }">

        <div class="space-y-6">
            <!-- 基础设置 -->
            <div>
                <div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1.5">
                    <div class="i-ph-sliders-horizontal" />
                    {{ t('settings.floatingBall.basic') }}
                </div>
                
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                    <!-- 启用开关 -->
                    <div class="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div class="flex flex-col gap-0.5">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.floatingBall.switch') }}</span>
                            <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('settings.floatingBall.description') }}</span>
                        </div>
                        <n-switch v-model:value="settings.enabled" />
                    </div>

                    <!-- 模式选择 -->
                    <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.floatingBall.mode') }}</span>
                            <span class="text-xs text-gray-400 dark:text-gray-500">{{ settings.mode === 'inject' ? t('settings.floatingBall.modeDescription.inject') : t('settings.floatingBall.modeDescription.native') }}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button class="relative py-2 px-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 group"
                                :class="settings.mode === 'inject' 
                                    ? 'border-primary/50 bg-primary/5 text-primary' 
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-700'"
                                @click="settings.mode = 'inject'">
                                <div class="i-ph-code text-lg" :class="settings.mode === 'inject' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'" />
                                <span class="text-sm font-medium">{{ t('settings.floatingBall.inject') }}</span>
                                <div v-if="settings.mode === 'inject'" class="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white dark:border-gray-800" />
                            </button>
                            <button class="relative py-2 px-3 rounded-lg border transition-all duration-200 flex items-center justify-center gap-2 group"
                                :class="settings.mode === 'native' 
                                    ? 'border-primary/50 bg-primary/5 text-primary' 
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-700'"
                                @click="settings.mode = 'native'">
                                <div class="i-ph-browser text-lg" :class="settings.mode === 'native' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'" />
                                <span class="text-sm font-medium">{{ t('settings.floatingBall.native') }}</span>
                                <div v-if="settings.mode === 'native'" class="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white dark:border-gray-800" />
                            </button>
                        </div>
                    </div>

                    <!-- 透明度 -->
                    <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.floatingBall.opacity') }}</span>
                            <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{{ settings.opacity }}%</span>
                        </div>
                        <n-slider v-model:value="settings.opacity" :min="10" :max="100" :step="5" :tooltip="false" class="scale-[0.98] origin-center" />
                    </div>
                </div>
            </div>

            <!-- 贴边自动缩进 -->
            <div>
                <div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1.5">
                    <div class="i-ph-arrow-line-right" />
                    {{ t('settings.floatingBall.autoHide.title') }}
                </div>
                
                <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden transition-all duration-300"
                    :class="{'border-primary shadow-sm': settings.autoHide.enabled}">
                    <!-- 头部开关 -->
                    <div class="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                        @click="settings.autoHide.enabled = !settings.autoHide.enabled">
                        <div class="flex flex-col gap-0.5">
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.floatingBall.autoHide.enable') }}</span>
                            <span class="text-xs text-gray-400 dark:text-gray-500">{{ settings.autoHide.enabled ? t('settings.floatingBall.autoHide.enableDescription') : t('settings.floatingBall.autoHide.disableDescription') }}</span>
                        </div>
                        <n-switch v-model:value="settings.autoHide.enabled" size="small" @click.stop />
                    </div>

                    <!-- 详细设置面板 -->
                    <Transition name="expand">
                        <div v-if="settings.autoHide.enabled" class="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/20 p-5 space-y-5">
                            <!-- 触发时间 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.floatingBall.autoHide.delay') }}</span>
                                    <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300">{{ settings.autoHide.delay }}s</span>
                                </div>
                                <n-slider v-model:value="settings.autoHide.delay" :min="0.5" :max="5" :step="0.5" :tooltip="false" class="scale-[0.98] origin-center" />
                            </div>

                            <!-- 缩进距离 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.floatingBall.autoHide.translateX') }}</span>
                                    <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300">{{ settings.autoHide.translateX }}%</span>
                                </div>
                                <n-slider v-model:value="settings.autoHide.translateX" :min="10" :max="90" :step="5" :tooltip="false" class="scale-[0.98] origin-center" />
                            </div>

                            <!-- 缩放比例 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.floatingBall.autoHide.scale') }}</span>
                                    <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300">{{ settings.autoHide.scale }}%</span>
                                </div>
                                <n-slider v-model:value="settings.autoHide.scale" :min="50" :max="100" :step="5" :tooltip="false" class="scale-[0.98] origin-center" />
                            </div>

                            <!-- 缩进后透明度 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.floatingBall.autoHide.opacity') }}</span>
                                    <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300">{{ settings.autoHide.opacity }}%</span>
                                </div>
                                <n-slider v-model:value="settings.autoHide.opacity" :min="10" :max="100" :step="5" :tooltip="false" class="scale-[0.98] origin-center" />
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('settings.floatingBall.autoSaveHint') }}</span>
                <n-button type="warning" size="small" @click="resetSettings">
                    <template #icon>
                        <div class="i-ph-arrow-counter-clockwise" />
                    </template>
                    {{ t('settings.floatingBall.reset') }}
                </n-button>
            </div>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";

import browser from "webextension-polyfill";
import { useI18n } from "vue-i18n";
import { getDefaultSettings } from "@/constants/defaultSettings";

interface SidebarSettings {
    enabled: boolean;
    mode?: 'inject' | 'native';
    position: { x: number; y: number };
    opacity: number;
    autoHide: {
        enabled: boolean
        delay: number
        opacity: number
        scale: number
        translateX: number
    }
}

interface LegacyUploadArea {
    status?: boolean
    location?: number
    opacity?: number
    position?: 'Left' | 'Right'
}

const { t } = useI18n();
const serializeSettings = (value: SidebarSettings) => JSON.stringify(value);
let isApplyingStorage = false;
const settings = ref<SidebarSettings>({
    enabled: true,
    mode: 'inject',
    position: { x: window.innerWidth - 60, y: window.innerHeight * 0.4 },
    opacity: getDefaultSettings().sidebarSettings.opacity,
    autoHide: getDefaultSettings().sidebarSettings.autoHide
});
let lastSerialized = serializeSettings(settings.value);

const props = defineProps<{
    show: boolean
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'save'): void;
}>();

watch(settings, async () => {
    if (isApplyingStorage) return;
    const serialized = serializeSettings(settings.value);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    await browser.storage.local.set({
        sidebarSettings: JSON.parse(serialized)
    });
}, { deep: true });

const resetSettings = (): void => {
    settings.value = {
        enabled: true,
        mode: 'inject',
        position: { x: window.innerWidth - 60, y: window.innerHeight * 0.4 },
        opacity: getDefaultSettings().sidebarSettings.opacity,
        autoHide: getDefaultSettings().sidebarSettings.autoHide
    };
};

const handleStorageChange = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') return
    if (changes.sidebarSettings) {
        const next = changes.sidebarSettings.newValue as Partial<SidebarSettings> | undefined
        if (next && typeof next === 'object') {
            const normalized: SidebarSettings = {
                enabled: next.enabled ?? true,
                position: next.position || { x: window.innerWidth - 60, y: window.innerHeight * 0.4 },
                opacity: next.opacity || getDefaultSettings().sidebarSettings.opacity,
                mode: next.mode || 'inject',
                autoHide: next.autoHide || getDefaultSettings().sidebarSettings.autoHide
            };
            const serialized = serializeSettings(normalized);
            if (serialized === lastSerialized) return;
            isApplyingStorage = true;
            settings.value = normalized;
            lastSerialized = serialized;
            Promise.resolve().then(() => {
                isApplyingStorage = false;
            });
        }
    }
}

onMounted(async () => {
    const res = await browser.storage.local.get(['uploadArea', 'sidebarSettings']) as {
        uploadArea?: LegacyUploadArea
        sidebarSettings?: SidebarSettings
    };

    if (res.uploadArea && !res.sidebarSettings) {
        const old = res.uploadArea;
        settings.value = {
            enabled: old.status !== false,
            mode: 'inject',
            position: {
                x: old.position === 'Left' ? 20 : window.innerWidth - 60,
                y: ((old.location || 40) / 100) * window.innerHeight
            },
            opacity: old.opacity || getDefaultSettings().sidebarSettings.opacity,
            autoHide: getDefaultSettings().sidebarSettings.autoHide
        };
        
    } else if (res.sidebarSettings) {
        settings.value = {
            ...res.sidebarSettings,
            mode: res.sidebarSettings.mode || 'inject',
            autoHide: res.sidebarSettings.autoHide || getDefaultSettings().sidebarSettings.autoHide
        };
    }

    browser.storage.onChanged.addListener(handleStorageChange)
});

onUnmounted(() => {
    browser.storage.onChanged.removeListener(handleStorageChange)
});

</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
    transition: all 0.25s ease-out;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
}

.expand-enter-to,
.expand-leave-from {
    opacity: 1;
    max-height: 500px;
}
</style>
