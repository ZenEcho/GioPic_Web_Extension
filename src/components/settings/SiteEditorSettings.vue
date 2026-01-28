<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" class="w-full max-w-[600px]" preset="card"
        :title="t('settings.siteEditor.title')" :bordered="false">

        <div class="flex flex-col gap-6">
            <div class="text-sm text-gray-500">
                {{ t('settings.siteEditor.description') }}
            </div>

            <!-- Add New -->
            <div class="flex flex-col sm:flex-row gap-2">
                <n-input v-model:value="newHostname" :placeholder="t('settings.siteEditor.hostnamePlaceholder')"
                    class="flex-1" />
                <n-select v-model:value="newEditorType" :options="editorOptions" class="w-full sm:w-40" filterable tag
                    placeholder="Editor Type" />
                <n-button type="primary" @click="addConfig" :disabled="!newHostname || !newEditorType">
                    {{ t('common.add') }}
                </n-button>
            </div>

            <!-- List Header -->
            <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-gray-500">
                    {{ t('settings.siteEditor.manage') }}
                </div>
                <div class="flex gap-1">
                    
                    <n-popconfirm v-if="searchText" @positive-click="deleteSearchResults"
                        :positive-text="t('common.confirm')" :negative-text="t('common.cancel')">
                        <template #trigger>
                            <n-button type="error" ghost  size="small" :disabled="filteredConfigList.length === 0">
                                {{ t('common.deleteSearchResults') }}
                            </n-button>
                        </template>
                        {{ t('common.deleteSearchResultsConfirm') }}
                    </n-popconfirm>
                    <n-popconfirm @positive-click="clearAllConfig" :positive-text="t('common.confirm')"
                        :negative-text="t('common.cancel')">
                        <template #trigger>
                            <n-button type="error" ghost size="small" :disabled="Object.keys(config).length === 0">
                                {{ t('common.clear') }}
                            </n-button>
                        </template>
                        {{ t('common.clearConfirm') }}
                    </n-popconfirm>
                </div>
            </div>

            <!-- Search -->
            <div class="flex gap-2 items-center">
                <n-input v-model:value="searchText" :placeholder="t('common.search')" class="flex-1">
                    <template #prefix>
                        <div class="i-ph-magnifying-glass text-gray-400" />
                    </template>
                </n-input>

            </div>

            <!-- List -->
            <div
                class="border rounded-lg divide-y dark:border-gray-700 dark:divide-gray-700 max-h-[400px] overflow-y-auto custom-scrollbar">
                <div v-if="filteredConfigList.length === 0" class="p-4 text-center text-gray-400">
                    {{ t('common.noData') }}
                </div>
                <div v-for="item in filteredConfigList" :key="item.hostname"
                    class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-2 sm:gap-0">
                    <div class="flex flex-col w-full sm:w-auto">
                        <span class="font-medium break-all">{{ item.hostname }}</span>
                        <span class="text-xs text-gray-500">{{ item.type }}</span>
                    </div>
                    <div class="flex gap-2 items-center w-full sm:w-auto">
                        <n-select :value="item.type" :options="editorOptions" size="small" class="flex-1 sm:w-36"
                            @update:value="(val) => updateConfig(item.hostname, val)" />
                        <n-button size="small" type="error" ghost @click="removeConfig(item.hostname)">
                            {{ t('common.delete') }}
                        </n-button>
                    </div>
                </div>
            </div>
        </div>
    </n-modal>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import browser from "webextension-polyfill";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { EDITOR_META } from "@/content/page/EditorInjector/meta";

const props = defineProps<{
    show: boolean
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
}>();

const { t } = useI18n();
const message = useMessage();

const config = ref<Record<string, string>>({});
const newHostname = ref('');
const newEditorType = ref<string | null>(null);
const searchText = ref('');

const editorOptions = EDITOR_META.map(meta => ({ label: meta.name, value: meta.id }));

const filteredConfigList = computed(() => {
    const list = Object.entries(config.value).map(([hostname, type]) => ({ hostname, type }));
    if (!searchText.value) return list;
    const lower = searchText.value.toLowerCase();
    return list.filter(item => item.hostname.toLowerCase().includes(lower) || item.type.toLowerCase().includes(lower));
});

onMounted(async () => {
    const res = await browser.storage.local.get('siteEditorConfig');
    config.value = (res.siteEditorConfig as Record<string, string>) || {};
});

const saveConfig = async () => {
    await browser.storage.local.set({ siteEditorConfig: config.value });
};

const addConfig = async () => {
    if (!newHostname.value || !newEditorType.value) return;
    config.value = { ...config.value, [newHostname.value]: newEditorType.value };
    await saveConfig();
    newHostname.value = '';
    newEditorType.value = null;
    message.success(t('common.success'));
};

const updateConfig = async (hostname: string, type: string) => {
    config.value = { ...config.value, [hostname]: type };
    await saveConfig();
};

const removeConfig = async (hostname: string) => {
    const newConfig = { ...config.value };
    delete newConfig[hostname];
    config.value = newConfig;
    await saveConfig();
};

const clearAllConfig = async () => {
    config.value = {};
    await saveConfig();
    message.success(t('common.success'));
};

const deleteSearchResults = async () => {
    if (!searchText.value) return;
    const newConfig = { ...config.value };
    filteredConfigList.value.forEach(item => {
        delete newConfig[item.hostname];
    });
    config.value = newConfig;
    await saveConfig();
    message.success(t('common.success'));
    searchText.value = ''; // Optional: clear search after delete
};
</script>
