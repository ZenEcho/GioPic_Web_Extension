<template>
    <n-modal
        :show="show"
        @update:show="(val: boolean) => emit('update:show', val)"
        class="w-full max-w-[760px]"
        preset="card"
        :title="t('settings.pluginMarketAccess.title')"
        :bordered="false"
    >
        <div class="flex flex-col gap-4">
            <div class="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <div>{{ t('settings.pluginMarketAccess.description') }}</div>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {{ t('settings.pluginMarketAccess.allowAllSites') }}
                        </div>
                        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {{ t('settings.pluginMarketAccess.allowAllSitesHint') }}
                        </div>
                    </div>
                    <n-switch v-model:value="allowAllSites" @update:value="setAllowAllSites" />
                </div>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <n-input
                    v-model:value="searchText"
                    :placeholder="t('common.search')"
                    class="w-full sm:w-64"
                    size="small"
                    autofocus
                >
                    <template #prefix>
                        <div class="i-ph-magnifying-glass text-gray-400" />
                    </template>
                </n-input>

                <div class="flex gap-2">
                    <n-popconfirm
                        v-if="searchText"
                        @positive-click="deleteSearchResults"
                        :positive-text="t('common.confirm')"
                        :negative-text="t('common.cancel')"
                    >
                        <template #trigger>
                            <n-button type="error" ghost size="small" :disabled="filteredSites.length === 0">
                                {{ t('common.deleteSearchResults') }}
                            </n-button>
                        </template>
                        {{ t('settings.pluginMarketAccess.deleteSearchConfirm') }}
                    </n-popconfirm>

                    <n-popconfirm
                        @positive-click="clearAllSites"
                        :positive-text="t('common.confirm')"
                        :negative-text="t('common.cancel')"
                    >
                        <template #trigger>
                            <n-button type="error" ghost size="small" :disabled="authorizedSites.length === 0">
                                {{ t('common.clear') }}
                            </n-button>
                        </template>
                        {{ t('settings.pluginMarketAccess.clearConfirm') }}
                    </n-popconfirm>
                </div>
            </div>

            <div class="rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-800/50">
                <div class="grid grid-cols-[1fr_88px] gap-3 border-b bg-blue-50/40 p-3 dark:border-gray-700 dark:bg-blue-900/10">
                    <n-input
                        v-model:value="newSite"
                        :placeholder="t('settings.pluginMarketAccess.placeholder')"
                        size="small"
                        @keyup.enter="addSite"
                    />
                    <n-button type="primary" size="small" @click="addSite">
                        {{ t('common.add') }}
                    </n-button>
                </div>

                <div class="grid grid-cols-[1fr_88px] gap-4 border-b bg-gray-50 p-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                    <div>{{ t('settings.pluginMarketAccess.site') }}</div>
                    <div class="text-center">{{ t('common.delete') }}</div>
                </div>

                <div class="max-h-[360px] overflow-y-auto custom-scrollbar divide-y dark:divide-gray-700">
                    <div v-if="filteredSites.length === 0" class="p-8 text-center text-gray-400">
                        {{ t('settings.pluginMarketAccess.empty') }}
                    </div>

                    <div
                        v-for="site in filteredSites"
                        :key="site"
                        class="grid grid-cols-[1fr_88px] gap-4 p-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        <div class="min-w-0">
                            <div class="break-all font-medium text-gray-800 dark:text-gray-100">{{ site }}</div>
                            <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {{ t('settings.pluginMarketAccess.summary') }}
                            </div>
                        </div>
                        <div class="flex justify-center">
                            <n-button text class="text-gray-400 hover:text-red-500 transition-colors" @click="removeSite(site)">
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import browser from 'webextension-polyfill'
import {
    PLUGIN_MARKET_ALLOW_ALL_SITES_KEY,
    PLUGIN_MARKET_AUTHORIZED_SITES_KEY,
} from '@/constants/pluginMarketAccess'
import {
    normalizePluginMarketAllowAllSites,
    normalizePluginMarketAuthorizedSite,
    normalizePluginMarketAuthorizedSites,
    savePluginMarketAllowAllSites,
    savePluginMarketAuthorizedSites,
} from '@/utils/pluginMarketAccess'

defineProps<{
    show: boolean
}>()

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void
}>()

const { t } = useI18n()
const message = useMessage()

const allowAllSites = ref(false)
const authorizedSites = ref<string[]>([])
const newSite = ref('')
const searchText = ref('')

const filteredSites = computed(() => {
    const keyword = searchText.value.trim().toLowerCase()
    if (!keyword) {
        return authorizedSites.value
    }

    return authorizedSites.value.filter(site => site.toLowerCase().includes(keyword))
})

async function loadSites() {
    const result = await browser.storage.local.get([
        PLUGIN_MARKET_ALLOW_ALL_SITES_KEY,
        PLUGIN_MARKET_AUTHORIZED_SITES_KEY,
    ])
    allowAllSites.value = normalizePluginMarketAllowAllSites(result[PLUGIN_MARKET_ALLOW_ALL_SITES_KEY])
    authorizedSites.value = normalizePluginMarketAuthorizedSites(result[PLUGIN_MARKET_AUTHORIZED_SITES_KEY])
}

async function persistSites(sites: string[]) {
    authorizedSites.value = await savePluginMarketAuthorizedSites(sites)
}

async function setAllowAllSites(enabled: boolean) {
    allowAllSites.value = await savePluginMarketAllowAllSites(enabled)
    message.success(t('common.success'))
}

async function addSite() {
    const normalizedSite = normalizePluginMarketAuthorizedSite(newSite.value)
    if (!normalizedSite) {
        message.error(t('settings.pluginMarketAccess.invalidSite'))
        return
    }

    if (authorizedSites.value.includes(normalizedSite)) {
        message.warning(t('settings.pluginMarketAccess.duplicateSite'))
        return
    }

    await persistSites([...authorizedSites.value, normalizedSite])
    newSite.value = ''
    message.success(t('settings.pluginMarketAccess.addSuccess'))
}

async function removeSite(site: string) {
    await persistSites(authorizedSites.value.filter(item => item !== site))
    message.success(t('settings.pluginMarketAccess.removeSuccess'))
}

async function clearAllSites() {
    await persistSites([])
    message.success(t('common.success'))
}

async function deleteSearchResults() {
    const matchedSites = new Set(filteredSites.value)
    await persistSites(authorizedSites.value.filter(site => !matchedSites.has(site)))
    searchText.value = ''
    message.success(t('common.success'))
}

const handleStorageChange = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') {
        return
    }

    if (changes[PLUGIN_MARKET_ALLOW_ALL_SITES_KEY]) {
        allowAllSites.value = normalizePluginMarketAllowAllSites(
            changes[PLUGIN_MARKET_ALLOW_ALL_SITES_KEY].newValue,
        )
    }

    if (changes[PLUGIN_MARKET_AUTHORIZED_SITES_KEY]) {
        authorizedSites.value = normalizePluginMarketAuthorizedSites(
            changes[PLUGIN_MARKET_AUTHORIZED_SITES_KEY].newValue,
        )
    }
}

onMounted(() => {
    void loadSites()
    browser.storage.onChanged.addListener(handleStorageChange)
})

onBeforeUnmount(() => {
    browser.storage.onChanged.removeListener(handleStorageChange)
})
</script>
