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
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" class="w-full max-w-[500px]" preset="card"
        :title="t('settings.floatingBall.title')" :bordered="false">

        <div class="flex flex-col gap-6">
            <!-- Switch & Opacity -->
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <label class="font-medium">{{ t('settings.floatingBall.switch') }}</label>
                    <n-switch v-model:value="settings.enabled" />
                </div>

                <div class="flex items-center justify-between">
                    <label class="font-medium">{{ t('settings.floatingBall.mode') }}</label>
                    <n-radio-group v-model:value="settings.mode" size="small">
                        <n-radio-button value="inject">{{ t('settings.floatingBall.inject') }}</n-radio-button>
                        <n-radio-button value="native">{{ t('settings.floatingBall.native') }}</n-radio-button>
                    </n-radio-group>
                </div>

                <div class="space-y-2">
                    <div class="flex justify-between">
                        <label>{{ t('settings.floatingBall.opacity') }}</label>
                        <span>{{ settings.opacity }}%</span>
                    </div>
                    <n-slider v-model:value="settings.opacity" :min="10" :max="100" :step="5" />
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex flex-row justify-end">
                <n-button type="warning" size="small" @click="resetSettings">{{ t('settings.floatingBall.reset')
                    }}</n-button>
            </div>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";

import browser from "webextension-polyfill";
import { useI18n } from "vue-i18n";

interface SidebarSettings {
    enabled: boolean;
    mode?: 'inject' | 'native';
    position: { x: number; y: number };
    opacity: number;
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
    opacity: 80
});
let lastSerialized = serializeSettings(settings.value);

const props = defineProps<{
    show: boolean
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'save'): void;
}>();

// 自动保存监听器：当设置发生变化时，实时写入 storage.local
// Auto-save watcher
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
        opacity: 80
    };
};

// 监听来自其他页面（如 Content Script 或其他选项页）的存储变化，保持设置同步
const handleStorageChange = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') return
    if (changes.sidebarSettings) {
        const next = changes.sidebarSettings.newValue as SidebarSettings | undefined
        if (next && typeof next === 'object') {
            const normalized = {
                ...next,
                mode: next.mode || 'inject'
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

    // 迁移逻辑：如果存在旧版配置 (uploadArea) 且无新版配置，则进行迁移
    // Migration Logic (Same as WebSidebar to ensure consistency if Settings opened first)
    if (res.uploadArea && !res.sidebarSettings) {
        const old = res.uploadArea;
        settings.value = {
            enabled: old.status !== false,
            mode: 'inject',
            position: {
                x: old.position === 'Left' ? 20 : window.innerWidth - 60,
                y: ((old.location || 40) / 100) * window.innerHeight
            },
            opacity: old.opacity || 80
        };
        // 这里不立即保存是为了避免与后续的自动保存冲突，只有在用户点击保存时才会保存
        
    } else if (res.sidebarSettings) {
        settings.value = {
            ...res.sidebarSettings,
            mode: res.sidebarSettings.mode || 'inject'
        };
    }

    browser.storage.onChanged.addListener(handleStorageChange)
});

onUnmounted(() => {
    browser.storage.onChanged.removeListener(handleStorageChange)
});

</script>
