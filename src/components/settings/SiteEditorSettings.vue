<!--
 * Component Name: SiteEditorSettings
 * Author: GioPic Team
 * Description: 网站-编辑器绑定管理组件，用于配置 Content Script 在特定域名下的行为。
 * 
 * Functional Domain:
 * Settings (全局设置) - 网站编辑器绑定
 * 
 * Key Features:
 * - 绑定管理：手动关联域名与编辑器类型（如 Discuz, Markdown, RichText）
 * - 行为控制：针对特定域名启用/禁用悬浮球或预览功能
 * - 批量操作：支持搜索、筛选和批量删除配置
 * - 数据同步：实时监听 storage.local 变化，实现多页面数据一致性
 * 
 * Props:
 * - show (boolean): 模态框显示状态
 * 
 * Events:
 * - update:show: 更新显示状态
 -->
<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" class="w-full max-w-[800px]" preset="card"
        :title="t('settings.siteEditor.title')" :bordered="false">

        <div class="flex flex-col gap-4">
            <div class="text-sm text-gray-500">
                {{ t('settings.siteEditor.description') }}
            </div>

            <!-- 工具栏与搜索 -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <n-input v-model:value="searchText" :placeholder="t('common.search')" class="w-full sm:w-64" size="small" autofocus>
                    <template #prefix>
                        <div class="i-ph-magnifying-glass text-gray-400" />
                    </template>
                </n-input>

                <div class="flex gap-2">
                    <n-popconfirm v-if="searchText" @positive-click="deleteSearchResults"
                        :positive-text="t('common.confirm')" :negative-text="t('common.cancel')">
                        <template #trigger>
                            <n-button type="error" ghost size="small" :disabled="filteredConfigList.length === 0">
                                {{ t('common.deleteSearchResults') }}
                            </n-button>
                        </template>
                        {{ t('common.deleteSearchResultsConfirm') }}
                    </n-popconfirm>
                    <n-popconfirm @positive-click="clearAllConfig" :positive-text="t('common.confirm')"
                        :negative-text="t('common.cancel')">
                        <template #trigger>
                            <n-button type="error" ghost size="small" :disabled="allHostnames.length === 0">
                                {{ t('common.clear') }}
                            </n-button>
                        </template>
                        {{ t('common.clearConfirm') }}
                    </n-popconfirm>
                </div>
            </div>

            <!-- 数据表格 -->
            <div class="border rounded-lg dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800/50 flex flex-col">
                <!-- 表头 -->
                <div class="grid grid-cols-[1fr_160px_70px_70px_40px] gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 text-xs font-medium text-gray-500 uppercase tracking-wider items-center">
                    <div>{{ t('settings.siteEditor.hostname') }}</div> <!-- 域名/URL -->
                    <div>{{ t('settings.siteEditor.editorType') }}</div>
                    <div class="text-center">{{ t('settings.floatingBall.switch') }}</div>
                    <div class="text-center">{{ t('settings.hoverPreview') }}</div>
                    <div></div>
                </div>

                <!-- 添加行 -->
                <div class="grid grid-cols-[1fr_160px_70px_70px_40px] gap-4 p-3 border-b dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10 items-center">
                    <div>
                        <n-input v-model:value="newHostname" :placeholder="t('settings.siteEditor.hostnamePlaceholder')" size="small" @keyup.enter="addConfig" />
                    </div>
                    <div>
                        <n-select v-model:value="newEditorType" :options="editorOptions" size="small" filterable tag clearable
                            :placeholder="t('settings.siteEditor.editorType')" />
                    </div>
                    <div class="flex justify-center">
                        <n-switch v-model:value="newEnableFloatingBall" size="small">
                            <template #checked-icon><div class="i-ph-sidebar" /></template>
                            <template #unchecked-icon><div class="i-ph-sidebar text-gray-400" /></template>
                        </n-switch>
                    </div>
                    <div class="flex justify-center">
                        <n-switch v-model:value="newEnablePreview" size="small">
                            <template #checked-icon><div class="i-ph-eye" /></template>
                            <template #unchecked-icon><div class="i-ph-eye text-gray-400" /></template>
                        </n-switch>
                    </div>
                    <div class="flex justify-center">
                        <n-button type="primary" size="tiny" circle @click="addConfig" :disabled="!newHostname">
                            <template #icon><div class="i-ph-plus" /></template>
                        </n-button>
                    </div>
                </div>

                <!-- 列表行 -->
                <div class="overflow-y-auto max-h-[400px] custom-scrollbar divide-y dark:divide-gray-700">
                    <div v-if="filteredConfigList.length === 0" class="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                        <div class="i-ph-list-dashes text-3xl opacity-50" />
                        {{ t('common.noData') }}
                    </div>
                    
                    <div v-for="item in filteredConfigList" :key="item.hostname"
                        class="grid grid-cols-[1fr_160px_70px_70px_40px] gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors items-center group">
                        
                        <!-- 域名 -->
                        <div class="font-medium break-all select-all text-sm">
                            {{ item.hostname }}
                        </div>

                        <!-- 编辑器选择 -->
                        <div>
                            <n-select 
                                :value="item.editorType" 
                                :options="editorOptions" 
                                size="small" 
                                clearable
                                :placeholder="t('settings.siteEditor.editorType')"
                                @update:value="(val: string | null) => updateEditorType(item.hostname, val)" 
                            />
                        </div>

                        <!-- 悬浮球开关 -->
                        <div class="flex justify-center">
                            <n-switch 
                                :value="item.enableFloatingBall" 
                                size="small"
                                @update:value="(val: boolean) => updateFloatingBall(item.hostname, val)"
                            >
                                <template #checked-icon><div class="i-ph-sidebar" /></template>
                                <template #unchecked-icon><div class="i-ph-sidebar text-gray-400" /></template>
                            </n-switch>
                        </div>

                        <!-- 预览开关 -->
                        <div class="flex justify-center">
                            <n-switch 
                                :value="item.enablePreview" 
                                size="small"
                                @update:value="(val: boolean) => updatePreview(item.hostname, val)"
                            >
                                <template #checked-icon><div class="i-ph-eye" /></template>
                                <template #unchecked-icon><div class="i-ph-eye text-gray-400" /></template>
                            </n-switch>
                        </div>

                        <!-- 删除按钮 -->
                        <div class="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <n-button text class="text-gray-400 hover:text-red-500 transition-colors" @click="removeConfig(item.hostname)">
                                <div class="i-ph-trash text-lg" />
                            </n-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </n-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import browser from "webextension-polyfill";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { usePluginStore } from "@/stores/plugin";

const props = defineProps<{
    show: boolean
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
}>();

const { t } = useI18n();
const message = useMessage();
const pluginStore = usePluginStore();

// 状态定义
const siteEditorConfig = ref<Record<string, string>>({});
const disabledBallSites = ref<string[]>([]);
const disabledPreviewSites = ref<string[]>([]);

const newHostname = ref('');
const newEditorType = ref<string | null>(null);
const newEnableFloatingBall = ref(true);
const newEnablePreview = ref(true);
const searchText = ref('');

const editorOptions = computed(() => {
    const enabledEditorPlugins = pluginStore.editorAdapterPlugins.filter(plugin => plugin.enabled !== false);
    const options = new Map(
        enabledEditorPlugins.map(plugin => [
            plugin.editorAdapter.editorType,
            {
                label: plugin.editorAdapter.displayName || plugin.name || plugin.editorAdapter.editorType,
                value: plugin.editorAdapter.editorType,
            },
        ]),
    );


    Object.values(siteEditorConfig.value).forEach((editorType) => {
        if (editorType && !options.has(editorType)) {
            options.set(editorType, { label: editorType, value: editorType });
        }
    });

    return Array.from(options.values());
});

// 计算属性
// 合并所有配置来源（编辑器绑定、禁用悬浮球列表、禁用预览列表）以生成完整域名列表
const allHostnames = computed(() => {
    const set = new Set<string>();
    Object.keys(siteEditorConfig.value).forEach(h => set.add(h));
    disabledBallSites.value.forEach(h => set.add(h));
    disabledPreviewSites.value.forEach(h => set.add(h));
    return Array.from(set).sort();
});

// 根据搜索关键词过滤配置列表，并构建每一行的完整状态对象
const filteredConfigList = computed(() => {
    const list = allHostnames.value.map(hostname => ({
        hostname,
        editorType: siteEditorConfig.value[hostname] || null,
        enableFloatingBall: !disabledBallSites.value.includes(hostname),
        enablePreview: !disabledPreviewSites.value.includes(hostname)
    }));

    if (!searchText.value) return list;
    const lower = searchText.value.toLowerCase();
    return list.filter(item => 
        item.hostname.toLowerCase().includes(lower) || 
        (item.editorType && item.editorType.toLowerCase().includes(lower))
    );
});

// 存储操作
// 加载配置：从 localStorage 中读取编辑器绑定、禁用悬浮球列表、禁用预览列表
const loadConfig = async () => {
    const res = await browser.storage.local.get(['siteEditorConfig', 'sidebar_disabled_sites', 'preview_disabled_sites']);
    siteEditorConfig.value = (res.siteEditorConfig as Record<string, string>) || {};
    
    // 确保数组类型，避免存储损坏时 forEach 报错
    disabledBallSites.value = Array.isArray(res.sidebar_disabled_sites) ? res.sidebar_disabled_sites : [];
    disabledPreviewSites.value = Array.isArray(res.preview_disabled_sites) ? res.preview_disabled_sites : [];
};

const handleStorageChange = (changes: any, area: string) => {
    if (area === 'local') {
        if (changes.siteEditorConfig) {
            siteEditorConfig.value = (changes.siteEditorConfig.newValue as Record<string, string>) || {};
        }
        if (changes.sidebar_disabled_sites) {
            const newVal = changes.sidebar_disabled_sites.newValue;
            disabledBallSites.value = Array.isArray(newVal) ? newVal : [];
        }
        if (changes.preview_disabled_sites) {
            const newVal = changes.preview_disabled_sites.newValue;
            disabledPreviewSites.value = Array.isArray(newVal) ? newVal : [];
        }
    }
};

onMounted(() => {
    void pluginStore.loadPlugins();
    void loadConfig();
    browser.storage.onChanged.addListener(handleStorageChange);
});

onUnmounted(() => {
    browser.storage.onChanged.removeListener(handleStorageChange);
});

// 操作方法
const addConfig = async () => {
    if (!newHostname.value) return;
    const hostname = newHostname.value.trim();
    if (!hostname) return;

    // 1. 更新编辑器配置
    if (newEditorType.value) {
        siteEditorConfig.value = { ...siteEditorConfig.value, [hostname]: newEditorType.value };
        await browser.storage.local.set({ siteEditorConfig: siteEditorConfig.value });
    } else {
        // 即使没有选择编辑器，我们仍然添加一个空条目来“跟踪”该站点
        // 这确保了即使稍后启用了这两个功能，它也会出现在列表中
        siteEditorConfig.value = { ...siteEditorConfig.value, [hostname]: "" };
        await browser.storage.local.set({ siteEditorConfig: siteEditorConfig.value });
    }

    // 2. 更新悬浮球配置 (存储“禁用”列表)
    // 如果启用为 FALSE，则添加到禁用列表。
    let newBallSites = [...disabledBallSites.value];
    if (!newEnableFloatingBall.value) {
        if (!newBallSites.includes(hostname)) {
            newBallSites.push(hostname);
        }
    } else {
        // 如果启用为 TRUE，则确保它不在禁用列表中
        newBallSites = newBallSites.filter(h => h !== hostname);
    }
    disabledBallSites.value = newBallSites;
    await browser.storage.local.set({ sidebar_disabled_sites: newBallSites });

    // 3. 更新预览配置
    let newPreviewSites = [...disabledPreviewSites.value];
    if (!newEnablePreview.value) {
        if (!newPreviewSites.includes(hostname)) {
            newPreviewSites.push(hostname);
        }
    } else {
        newPreviewSites = newPreviewSites.filter(h => h !== hostname);
    }
    disabledPreviewSites.value = newPreviewSites;
    await browser.storage.local.set({ preview_disabled_sites: newPreviewSites });

    newHostname.value = '';
    newEditorType.value = null;
    newEnableFloatingBall.value = true;
    newEnablePreview.value = true;
    message.success(t('common.success'));
};

// 更新特定域名的编辑器类型
const updateEditorType = async (hostname: string, type: string | null) => {
    const newConfig = { ...siteEditorConfig.value };
    if (type) {
        newConfig[hostname] = type;
    } else {
        delete newConfig[hostname];
    }
    siteEditorConfig.value = newConfig;
    await browser.storage.local.set({ siteEditorConfig: newConfig });
};

// 更新特定域名的悬浮球启用状态
const updateFloatingBall = async (hostname: string, enabled: boolean) => {
    // 注意：enabled = true 表示从禁用列表中移除
    //      enabled = false 表示添加到禁用列表
    
    // 创建新数组以确保响应式更新触发正常
    let newDisabledSites = [...disabledBallSites.value];
    
    if (!enabled) {
        // 关闭 -> 添加到禁用列表
        if (!newDisabledSites.includes(hostname)) {
            newDisabledSites.push(hostname);
        }
    } else {
        // 开启 -> 从禁用列表移除
        newDisabledSites = newDisabledSites.filter(h => h !== hostname);
    }
    
    disabledBallSites.value = newDisabledSites;
    await browser.storage.local.set({ sidebar_disabled_sites: newDisabledSites });
};

const updatePreview = async (hostname: string, enabled: boolean) => {
    let newDisabledSites = [...disabledPreviewSites.value];
    
    if (!enabled) {
        if (!newDisabledSites.includes(hostname)) {
            newDisabledSites.push(hostname);
        }
    } else {
        newDisabledSites = newDisabledSites.filter(h => h !== hostname);
    }
    
    disabledPreviewSites.value = newDisabledSites;
    await browser.storage.local.set({ preview_disabled_sites: newDisabledSites });
};

const removeConfig = async (hostname: string) => {
    // 从所有配置中移除
    const newEditorConfig = { ...siteEditorConfig.value };
    delete newEditorConfig[hostname];
    siteEditorConfig.value = newEditorConfig;

    disabledBallSites.value = disabledBallSites.value.filter(h => h !== hostname);
    disabledPreviewSites.value = disabledPreviewSites.value.filter(h => h !== hostname);

    await browser.storage.local.set({
        siteEditorConfig: siteEditorConfig.value,
        sidebar_disabled_sites: disabledBallSites.value,
        preview_disabled_sites: disabledPreviewSites.value
    });
};

const clearAllConfig = async () => {
    siteEditorConfig.value = {};
    disabledBallSites.value = [];
    disabledPreviewSites.value = [];
    
    await browser.storage.local.set({
        siteEditorConfig: {},
        sidebar_disabled_sites: [],
        preview_disabled_sites: []
    });
    message.success(t('common.success'));
};

const deleteSearchResults = async () => {
    if (!searchText.value) return;
    
    const newEditorConfig = { ...siteEditorConfig.value };
    let newBallSites = [...disabledBallSites.value];
    let newPreviewSites = [...disabledPreviewSites.value];

    filteredConfigList.value.forEach(item => {
        delete newEditorConfig[item.hostname];
        newBallSites = newBallSites.filter(h => h !== item.hostname);
        newPreviewSites = newPreviewSites.filter(h => h !== item.hostname);
    });

    siteEditorConfig.value = newEditorConfig;
    disabledBallSites.value = newBallSites;
    disabledPreviewSites.value = newPreviewSites;

    await browser.storage.local.set({
        siteEditorConfig: newEditorConfig,
        sidebar_disabled_sites: newBallSites,
        preview_disabled_sites: newPreviewSites
    });

    message.success(t('common.success'));
    searchText.value = '';
};
</script>
