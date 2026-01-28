<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" class="w-full max-w-[500px]" preset="card"
        :title="t('settings.sidebarSetting.title')" :bordered="false">

        <div class="flex flex-col gap-6">
            <!-- Switch & Opacity -->
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <label class="font-medium">{{ t('settings.sidebarSetting.switch') }}</label>
                    <n-switch v-model:value="settings.enabled" />
                </div>

                <div class="flex items-center justify-between">
                    <label class="font-medium">{{ t('settings.sidebarSetting.mode') }}</label>
                    <n-radio-group v-model:value="settings.mode" size="small">
                        <n-radio-button value="inject">{{ t('settings.sidebarSetting.inject') }}</n-radio-button>
                        <n-radio-button value="native">{{ t('settings.sidebarSetting.native') }}</n-radio-button>
                    </n-radio-group>
                </div>

                <div class="space-y-2">
                    <div class="flex justify-between">
                        <label>{{ t('settings.sidebarSetting.opacity') }}</label>
                        <span>{{ settings.opacity }}%</span>
                    </div>
                    <n-slider v-model:value="settings.opacity" :min="10" :max="100" :step="5" />
                </div>
            </div>

            <!-- Disabled Sites -->
            <div class="border-t pt-4 dark:border-gray-700">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-medium">{{ t('settings.sidebarSetting.disabledSites') }}</h4>
                    <div class="flex gap-1">
                        <n-popconfirm v-if="searchText" @positive-click="deleteSearchResults"
                            :positive-text="t('common.confirm')" :negative-text="t('common.cancel')">
                            <template #trigger>
                                <n-button type="error" ghost size="small"
                                    :disabled="filteredDisabledSites.length === 0">
                                    {{ t('common.deleteSearchResults') }}
                                </n-button>
                            </template>
                            {{ t('common.deleteSearchResultsConfirm') }}
                        </n-popconfirm>
                        <n-popconfirm @positive-click="clearAllDisabledSites" :positive-text="t('common.confirm')"
                            :negative-text="t('common.cancel')">
                            <template #trigger>
                                <n-button type="error" ghost size="small" :disabled="disabledSites.length === 0">
                                    {{ t('common.clear') }}
                                </n-button>
                            </template>
                            {{ t('common.clearConfirm') }}
                        </n-popconfirm>

                    </div>
                </div>

                <div class="mb-3 flex gap-2">
                    <n-input v-model:value="searchText" :placeholder="t('common.search')" size="small" class="flex-1">
                        <template #prefix>
                            <div class="i-ph-magnifying-glass text-gray-400" />
                        </template>
                    </n-input>

                </div>

                <div v-if="filteredDisabledSites.length === 0"
                    class="text-gray-400 text-sm italic text-center py-4 bg-gray-50 dark:bg-gray-800 rounded">
                    {{ t('settings.sidebarSetting.noDisabledSites') }}
                </div>

                <div v-else class="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
                    <div v-for="site in filteredDisabledSites" :key="site"
                        class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                        <span class="text-sm truncate flex-1 mr-2">{{ site }}</span>
                        <button @click="removeSite(site)"
                            class="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            {{ t('settings.sidebarSetting.remove') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex flex-row justify-end">
                <n-button type="warning" size="small" @click="resetSettings">{{ t('settings.sidebarSetting.reset')
                    }}</n-button>
            </div>
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";

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
const settings = ref<SidebarSettings>({

    enabled: true,
    mode: 'inject',
    position: { x: window.innerWidth - 60, y: window.innerHeight * 0.4 },
    opacity: 80
});

const disabledSites = ref<string[]>([]);
const searchText = ref('');

const props = defineProps<{
    show: boolean
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'save'): void;
}>();

const filteredDisabledSites = computed(() => {
    if (!searchText.value) return disabledSites.value;
    const lower = searchText.value.toLowerCase();
    return disabledSites.value.filter(site => site.toLowerCase().includes(lower));
});

// Auto-save watcher
watch([settings, disabledSites], async () => {
    await browser.storage.local.set({
        sidebarSettings: JSON.parse(JSON.stringify(settings.value)),
        sidebar_disabled_sites: JSON.parse(JSON.stringify(disabledSites.value))
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

const removeSite = (site: string) => {
    disabledSites.value = disabledSites.value.filter(s => s !== site);
};

const clearAllDisabledSites = () => {
    disabledSites.value = [];
};

const deleteSearchResults = () => {
    if (!searchText.value) return;
    // Remove sites that are currently filtered (i.e., visible in search results)
    disabledSites.value = disabledSites.value.filter(site => !site.toLowerCase().includes(searchText.value.toLowerCase()));
    searchText.value = '';
};

const handleStorageChange = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') return
    if (changes.sidebarSettings) {
        const next = changes.sidebarSettings.newValue as SidebarSettings | undefined
        if (next && typeof next === 'object') {
            settings.value = {
                ...next,
                mode: next.mode || 'inject'
            }
        }
    }
    if (changes.sidebar_disabled_sites) {
        const next = changes.sidebar_disabled_sites.newValue as unknown
        disabledSites.value = Array.isArray(next) ? (next as string[]) : []
    }
}

onMounted(async () => {
    const res = await browser.storage.local.get(['uploadArea', 'sidebarSettings', 'sidebar_disabled_sites']) as {
        uploadArea?: LegacyUploadArea
        sidebarSettings?: SidebarSettings
        sidebar_disabled_sites?: string[]
    };

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
        // We don't save immediately here to avoid conflict, only on save()
    } else if (res.sidebarSettings) {
        settings.value = {
            ...res.sidebarSettings,
            mode: res.sidebarSettings.mode || 'inject'
        };
    }

    if (Array.isArray(res.sidebar_disabled_sites)) {
        disabledSites.value = res.sidebar_disabled_sites;
    }

    browser.storage.onChanged.addListener(handleStorageChange)
});

onUnmounted(() => {
    browser.storage.onChanged.removeListener(handleStorageChange)
});

</script>
