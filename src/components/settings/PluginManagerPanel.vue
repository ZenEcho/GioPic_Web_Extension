<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog, useMessage } from 'naive-ui'
import { usePluginStore } from '@/stores/plugin'
import { fetchPluginMarketplaceList, recordPluginMarketplaceDownload } from '@/services/pluginMarketplace'
import type { DetectorActionFieldSchema, PluginInputSchema, PluginKind, PluginMarketplaceEntry, PluginMeta } from '@/types'
import { validatePlugin } from '@/utils/pluginCore'

type ViewMode = 'installed' | 'market'
type StatusFilter = 'all' | 'enabled' | 'disabled' | 'abnormal'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const pluginStore = usePluginStore()

const fileInput = ref<HTMLInputElement | null>(null)
const activeView = ref<ViewMode>('installed')
const searchQuery = ref('')
const marketSearchQuery = ref('')
const selectedKind = ref<'all' | PluginKind>('all')
const marketSelectedKind = ref<'all' | PluginKind>('all')
const selectedStatus = ref<StatusFilter>('all')
const activeCodePluginId = ref<string | null>(null)
const activeConfigPluginId = ref<string | null>(null)
const marketLoading = ref(false)
const marketLoadError = ref('')
const marketPlugins = ref<PluginMarketplaceEntry[]>([])
const installingPluginIds = ref<string[]>([])

const kindOptions = computed(() => [
  { value: 'all', label: t('settings.plugins.filterAllKinds') },
  { value: 'uploader', label: t('settings.plugins.kindUploader') },
  { value: 'site-detector', label: t('settings.plugins.kindSiteDetector') },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('settings.plugins.filterAllStatus') },
  { value: 'enabled', label: t('common.enabled') },
  { value: 'disabled', label: t('common.disabled') },
  { value: 'abnormal', label: t('settings.plugins.statusAbnormal') },
])

const validationMap = computed(() => {
  return new Map(
    pluginStore.plugins.map((plugin) => {
      const validation = validatePlugin(plugin)
      return [plugin.id, { valid: validation.valid, error: validation.error || '' }]
    }),
  )
})

const installedPluginMap = computed(() => new Map(pluginStore.plugins.map(plugin => [plugin.id, plugin])))

const marketplaceStats = computed(() => {
  const total = marketPlugins.value.length
  const installed = marketPlugins.value.filter(plugin => installedPluginMap.value.has(plugin.id)).length
  const updates = marketPlugins.value.filter((plugin) => {
    const installedPlugin = installedPluginMap.value.get(plugin.id)
    return installedPlugin && installedPlugin.version !== plugin.version
  }).length
  return { total, installed, updates }
})

const stats = computed(() => ({
  total: pluginStore.plugins.length,
  enabled: pluginStore.plugins.filter(plugin => plugin.enabled !== false).length,
  updates: marketplaceStats.value.updates,
}))

const filteredPlugins = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return pluginStore.plugins.filter((plugin) => {
    const enabled = plugin.enabled !== false
    const abnormal = validationMap.value.get(plugin.id)?.valid === false
    const matchesKind = selectedKind.value === 'all' || plugin.kind === selectedKind.value
    const matchesStatus = selectedStatus.value === 'all'
      || (selectedStatus.value === 'enabled' && enabled)
      || (selectedStatus.value === 'disabled' && !enabled)
      || (selectedStatus.value === 'abnormal' && abnormal)
    if (!matchesKind || !matchesStatus) {
      return false
    }
    if (!query) {
      return true
    }
    return [
      plugin.name,
      plugin.id,
      plugin.description,
      plugin.author,
      plugin.version,
      plugin.kind,
    ].some(item => item?.toLowerCase().includes(query))
  })
})

const filteredMarketPlugins = computed(() => {
  const query = marketSearchQuery.value.trim().toLowerCase()
  return marketPlugins.value.filter((plugin) => {
    const matchesKind = marketSelectedKind.value === 'all' || plugin.kind === marketSelectedKind.value
    if (!matchesKind) {
      return false
    }
    if (!query) {
      return true
    }
    return [
      plugin.name,
      plugin.id,
      plugin.description,
      plugin.authorName,
      plugin.version,
      plugin.kind,
    ].some(item => item?.toLowerCase().includes(query))
  })
})

const activeCodePlugin = computed(() => pluginStore.plugins.find(plugin => plugin.id === activeCodePluginId.value) ?? null)
const activeConfigPlugin = computed(() => pluginStore.plugins.find(plugin => plugin.id === activeConfigPluginId.value) ?? null)
const activeCode = computed(() => activeCodePlugin.value ? JSON.stringify(activeCodePlugin.value, null, 2) : '')
const activeConfigFields = computed<(PluginInputSchema | DetectorActionFieldSchema)[]>(() => {
  if (!activeConfigPlugin.value) {
    return []
  }
  return activeConfigPlugin.value.kind === 'uploader'
    ? activeConfigPlugin.value.uploader.inputs
    : (activeConfigPlugin.value.detector.actionForm || [])
})

function isAbnormal(plugin: PluginMeta) {
  return validationMap.value.get(plugin.id)?.valid === false
}

function isInstalling(pluginId: string) {
  return installingPluginIds.value.includes(pluginId)
}

function setInstalling(pluginId: string, value: boolean) {
  installingPluginIds.value = value
    ? Array.from(new Set([...installingPluginIds.value, pluginId]))
    : installingPluginIds.value.filter(id => id !== pluginId)
}

function getKindLabel(plugin: Pick<PluginMeta, 'kind'> | Pick<PluginMarketplaceEntry, 'kind'>) {
  return plugin.kind === 'site-detector'
    ? t('settings.plugins.kindSiteDetector')
    : t('settings.plugins.kindUploader')
}

function getStatusLabel(plugin: PluginMeta) {
  if (isAbnormal(plugin)) {
    return t('settings.plugins.statusAbnormal')
  }
  return plugin.enabled !== false ? t('common.enabled') : t('common.disabled')
}

function getConfigFieldCount(plugin: PluginMeta) {
  return plugin.kind === 'uploader'
    ? plugin.uploader.inputs.length
    : (plugin.detector.actionForm?.length || 0)
}

function hasConfig(plugin: PluginMeta) {
  return getConfigFieldCount(plugin) > 0
}

function getMarketplaceStateText(plugin: PluginMarketplaceEntry) {
  const installedPlugin = installedPluginMap.value.get(plugin.id)
  if (!installedPlugin) {
    return t('settings.plugins.marketNotInstalled')
  }
  if (installedPlugin.version === plugin.version) {
    return t('settings.plugins.marketInstalled')
  }
  return t('settings.plugins.marketUpdateAvailable')
}

function getMarketplaceActionText(plugin: PluginMarketplaceEntry) {
  const installedPlugin = installedPluginMap.value.get(plugin.id)
  if (!installedPlugin) {
    return t('settings.plugins.install')
  }
  if (installedPlugin.version === plugin.version) {
    return t('settings.plugins.reinstall')
  }
  return t('settings.plugins.update')
}

function formatMarketplaceDate(value?: string) {
  if (!value) {
    return t('settings.plugins.marketUnknownUpdate')
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? t('settings.plugins.marketUnknownUpdate')
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

async function loadMarketplacePlugins() {
  marketLoading.value = true
  marketLoadError.value = ''
  try {
    marketPlugins.value = await fetchPluginMarketplaceList()
  } catch (error: any) {
    marketLoadError.value = error?.message || t('settings.plugins.marketLoadFailed')
  } finally {
    marketLoading.value = false
  }
}

function handleImport() {
  fileInput.value?.click()
}

async function onFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  try {
    const text = await file.text()
    const plugin = JSON.parse(text) as PluginMeta
    const validation = validatePlugin(plugin)
    if (!validation.valid || !validation.normalized) {
      throw new Error(validation.error || 'Invalid plugin format')
    }
    await pluginStore.addPlugin(validation.normalized)
    message.success(t('settings.plugins.importSuccess', { name: validation.normalized.name }))
  } catch (error: any) {
    message.error(`${t('settings.plugins.importFailed')}: ${error.message}`)
  } finally {
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

async function handleMarketplaceInstall(plugin: PluginMarketplaceEntry) {
  if (isInstalling(plugin.id)) {
    return
  }
  const validation = validatePlugin(plugin.content)
  if (!validation.valid || !validation.normalized) {
    message.error(`${t('settings.plugins.marketInstallFailed')}: ${validation.error || t('settings.plugins.invalidPayload')}`)
    return
  }
  const installedPlugin = installedPluginMap.value.get(plugin.id)
  setInstalling(plugin.id, true)
  try {
    await pluginStore.addPlugin(plugin.content)
    message.success(installedPlugin
      ? t('settings.plugins.updateSuccess', { name: plugin.name })
      : t('settings.plugins.installSuccess', { name: plugin.name }))
    recordPluginMarketplaceDownload(plugin.id).catch(() => {})
  } catch (error: any) {
    message.error(`${t('settings.plugins.marketInstallFailed')}: ${error?.message || t('common.error')}`)
  } finally {
    setInstalling(plugin.id, false)
  }
}

async function handleTogglePlugin(plugin: PluginMeta) {
  const willEnable = plugin.enabled === false
  await pluginStore.togglePlugin(plugin.id)
  message.success(willEnable
    ? t('settings.plugins.enableSuccess', { name: plugin.name })
    : t('settings.plugins.disableSuccess', { name: plugin.name }))
}

function handleDelete(plugin: PluginMeta) {
  dialog.warning({
    title: t('common.delete'),
    content: t('settings.plugins.deleteConfirm', { name: plugin.name }),
    positiveText: t('common.delete'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      await pluginStore.removePlugin(plugin.id)
      message.success(t('settings.plugins.uninstallSuccess', { name: plugin.name }))
    },
  })
}

function openCode(plugin: PluginMeta) {
  activeCodePluginId.value = plugin.id
}

function openConfig(plugin: PluginMeta) {
  activeConfigPluginId.value = plugin.id
}

function closeCodeModal() {
  activeCodePluginId.value = null
}

function closeConfigModal() {
  activeConfigPluginId.value = null
}

async function copyCode() {
  if (!activeCode.value) {
    return
  }
  await navigator.clipboard.writeText(activeCode.value)
  message.success(t('common.copied'))
}

onMounted(() => {
  void pluginStore.loadPlugins()
  void loadMarketplacePlugins()
})
</script>

<template>
  <div class="space-y-6">
    <section class="bg-theme-console shadow-theme-soft dark:bg-theme-console rounded-[28px] border border-slate-200 border-theme-soft p-6 text-slate-900 shadow-sm md:p-7 dark:border-slate-700 dark:border-theme-soft dark:text-white">
      <div class="space-y-6">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="space-y-3">
            <div class="bg-theme-card dark:bg-theme-card text-theme-accent-strong dark:text-theme-accent-strong inline-flex items-center gap-2 rounded-full border border-slate-200 border-theme-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] shadow-sm dark:border-white/10">
              <div class="i-ph-stack-simple text-sm" />
              {{ t('settings.plugins.consoleBadge') }}
            </div>
            <div>
              <h2 class="text-2xl font-black md:text-3xl">{{ t('settings.plugins.heroTitle') }}</h2>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <n-button ghost :type="activeView === 'installed' ? 'primary' : 'default'" size="large" @click="activeView = 'installed'">
              {{ t('settings.plugins.installedSectionTitle') }}
            </n-button>
            <n-button ghost :type="activeView === 'market' ? 'primary' : 'default'" size="large" @click="activeView = 'market'">
              {{ t('settings.plugins.marketEntry') }}
            </n-button>
            <n-button type="primary" size="large" @click="handleImport">
              {{ t('settings.plugins.import') }}
            </n-button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div class="bg-theme-card dark:bg-theme-card rounded-2xl border border-slate-200 border-theme-soft p-4 shadow-sm dark:border-white/10">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">{{ t('settings.plugins.metricInstalled') }}</div>
            <div class="mt-3 text-3xl font-black">{{ stats.total }}</div>
          </div>
          <div class="bg-theme-card dark:bg-theme-card rounded-2xl border border-slate-200 border-theme-soft p-4 shadow-sm dark:border-white/10">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">{{ t('settings.plugins.metricEnabled') }}</div>
            <div class="text-theme-accent mt-3 text-3xl font-black">{{ stats.enabled }}</div>
          </div>
          <div class="bg-theme-card dark:bg-theme-card rounded-2xl border border-slate-200 border-theme-soft p-4 shadow-sm dark:border-white/10">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">{{ t('settings.plugins.marketUpdates') }}</div>
            <div class="mt-3 text-3xl font-black text-amber-500 dark:text-amber-300">{{ stats.updates }}</div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="activeView === 'installed'" class="space-y-4">
      <div class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 md:p-6">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div class="text-xl font-black text-slate-900 dark:text-slate-100">{{ t('settings.plugins.installedSectionTitle') }}</div>
            </div>

            <div class="flex flex-wrap gap-2">
              <n-button tertiary size="large" @click="pluginStore.loadPlugins()">{{ t('settings.plugins.refreshStatus') }}</n-button>
              <n-button tertiary size="large" @click="loadMarketplacePlugins">{{ t('settings.plugins.checkUpdates') }}</n-button>
            </div>
          </div>

          <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
            <n-input :value="searchQuery" @update:value="searchQuery = $event" :placeholder="t('settings.plugins.searchPlaceholder')" clearable size="large">
              <template #prefix>
                <div class="i-ph-magnifying-glass text-slate-400 text-lg" />
              </template>
            </n-input>
            <n-select v-model:value="selectedStatus" :options="statusOptions" size="large" />
            <n-select v-model:value="selectedKind" :options="kindOptions" size="large" />
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2 px-1 md:flex-row md:items-center md:justify-between">
        <div class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.plugins.results', { count: filteredPlugins.length, total: pluginStore.plugins.length }) }}
        </div>
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          {{ selectedStatus === 'all' ? t('settings.plugins.filterAllStatus') : statusOptions.find(item => item.value === selectedStatus)?.label }}
        </div>
      </div>

      <div v-if="filteredPlugins.length > 0" class="space-y-4">
        <article
          v-for="plugin in filteredPlugins"
          :key="plugin.id"
          class="rounded-[24px] border bg-white p-5 shadow-sm dark:bg-slate-900/70"
          :class="isAbnormal(plugin) ? 'border-rose-200 dark:border-rose-900/40' : 'border-slate-200 dark:border-slate-700'"
        >
          <div class="flex flex-col gap-5 xl:flex-row xl:justify-between">
            <div class="min-w-0 flex-1 space-y-4">
              <div class="flex items-start gap-4">
                <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-primary dark:bg-slate-800">
                  <img v-if="plugin.icon && plugin.icon.startsWith('http')" :src="plugin.icon" class="h-8 w-8 object-contain" alt="icon">
                  <div v-else :class="plugin.icon || 'i-ph-puzzle-piece-duotone'" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="text-lg font-black text-slate-900 dark:text-slate-100">{{ plugin.name }}</h3>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-primary dark:bg-slate-800">v{{ plugin.version }}</span>
                    <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ getKindLabel(plugin) }}</span>
                    <span
                      class="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      :class="isAbnormal(plugin)
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                        : plugin.enabled !== false
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                    >
                      {{ getStatusLabel(plugin) }}
                    </span>
                  </div>
                  <div class="mt-1 font-mono text-xs text-slate-400 dark:text-slate-500">{{ plugin.id }}</div>
                </div>
              </div>

              <p class="text-sm leading-7 text-slate-500 dark:text-slate-400">{{ plugin.description || t('settings.plugins.noDescription') }}</p>

              <div class="grid gap-3 md:grid-cols-3">
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
                  <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.fieldAuthor') }}</div>
                  <div class="mt-1 font-medium text-slate-700 dark:text-slate-200">{{ plugin.author || t('settings.plugins.unknownAuthor') }}</div>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
                  <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.fieldConfig') }}</div>
                  <div class="mt-1 font-medium text-slate-700 dark:text-slate-200">
                    {{ hasConfig(plugin) ? t('settings.plugins.configFieldCount', { count: getConfigFieldCount(plugin) }) : t('settings.plugins.noConfigFields') }}
                  </div>
                </div>
                <div class="rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
                  <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.fieldScript') }}</div>
                  <div class="mt-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                    {{ plugin.kind === 'uploader' ? 'uploader.script' : 'detector.detectScript / detector.extractScript' }}
                  </div>
                </div>
              </div>

            </div>

            <div class="flex w-full flex-col gap-3 xl:w-[260px]">
              <div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div>
                  <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.toggleLabel') }}</div>
                  <div class="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{{ plugin.enabled !== false ? t('common.enabled') : t('common.disabled') }}</div>
                </div>
                <n-switch :value="plugin.enabled !== false" @update:value="handleTogglePlugin(plugin)" />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <n-button secondary strong size="small" :disabled="!hasConfig(plugin)" @click="openConfig(plugin)">{{ t('settings.plugins.configure') }}</n-button>
                <n-button secondary strong size="small" @click="openCode(plugin)">{{ t('settings.plugins.viewCode') }}</n-button>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <a
                  v-if="plugin.homepage"
                  :href="plugin.homepage"
                  target="_blank"
                  class="giopic-link-btn justify-center border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:text-slate-300"
                >
                  {{ t('settings.plugins.homepage') }}
                </a>
                <div v-else class="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  {{ t('settings.plugins.noHomepage') }}
                </div>
                <n-button tertiary type="error" size="small" @click="handleDelete(plugin)">{{ t('common.delete') }}</n-button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="rounded-[24px] border border-dashed border-slate-300 bg-white py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div class="mb-4 flex justify-center">
          <div class="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/60">
            <div class="i-ph-puzzle-piece-duotone text-4xl text-slate-300 dark:text-slate-600" />
          </div>
        </div>
        <p class="mb-1 font-medium text-slate-600 dark:text-slate-300">
          {{ pluginStore.plugins.length === 0 ? t('settings.plugins.empty') : t('settings.plugins.noMatches') }}
        </p>
        <p class="mx-auto max-w-md text-sm text-slate-400 dark:text-slate-500">
          {{ pluginStore.plugins.length === 0 ? t('settings.plugins.emptyDesc') : t('settings.plugins.noMatchesDesc') }}
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-2">
          <n-button type="primary" @click="handleImport">{{ t('settings.plugins.import') }}</n-button>
          <n-button tertiary @click="activeView = 'market'">{{ t('settings.plugins.marketEntry') }}</n-button>
        </div>
      </div>
    </section>

    <section v-else class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 md:p-6">
      <div class="space-y-5">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div class="text-xl font-black text-slate-900 dark:text-slate-100">{{ t('settings.plugins.marketSectionTitle') }}</div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ t('settings.plugins.marketSectionDesc') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <n-button tertiary size="large" @click="activeView = 'installed'">{{ t('settings.plugins.backToManager') }}</n-button>
            <n-button tertiary size="large" @click="loadMarketplacePlugins">{{ t('settings.plugins.refreshMarket') }}</n-button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.marketAvailable') }}</div>
            <div class="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{{ marketplaceStats.total }}</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.marketInstalled') }}</div>
            <div class="mt-2 text-2xl font-black text-primary">{{ marketplaceStats.installed }}</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ t('settings.plugins.marketUpdates') }}</div>
            <div class="mt-2 text-2xl font-black text-amber-500">{{ marketplaceStats.updates }}</div>
          </div>
        </div>

        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
          <n-input :value="marketSearchQuery" @update:value="marketSearchQuery = $event" :placeholder="t('settings.plugins.marketSearchPlaceholder')" clearable size="large">
            <template #prefix>
              <div class="i-ph-magnifying-glass text-slate-400 text-lg" />
            </template>
          </n-input>
          <n-select v-model:value="marketSelectedKind" :options="kindOptions" size="large" />
        </div>

        <div v-if="marketLoadError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          {{ t('settings.plugins.marketLoadFailed') }}: {{ marketLoadError }}
        </div>

        <div v-if="marketLoading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="index in 3" :key="index" class="h-56 animate-pulse rounded-[24px] border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40" />
        </div>

        <div v-else-if="filteredMarketPlugins.length > 0" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="plugin in filteredMarketPlugins"
            :key="plugin.id"
            class="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
          >
            <div class="mb-4 flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-primary dark:bg-slate-800">
                  <img v-if="plugin.icon && plugin.icon.startsWith('http')" :src="plugin.icon" class="h-8 w-8 object-contain" alt="icon">
                  <div v-else :class="plugin.icon || 'i-ph-puzzle-piece-duotone'" />
                </div>
                <div class="min-w-0">
                  <h3 class="truncate text-lg font-black text-slate-900 dark:text-slate-100">{{ plugin.name }}</h3>
                  <div class="mt-1 truncate text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{{ plugin.id }}</div>
                </div>
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-primary dark:bg-slate-800">v{{ plugin.version }}</span>
            </div>

            <div class="mb-4 flex flex-wrap gap-2">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ getKindLabel(plugin) }}</span>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ getMarketplaceStateText(plugin) }}</span>
            </div>

            <p class="mb-4 line-clamp-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{{ plugin.description || t('settings.plugins.noDescription') }}</p>

            <div class="mb-4 space-y-2 text-sm">
              <div class="rounded-xl bg-slate-50 px-3 py-2 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{{ plugin.authorName }}</div>
              <div class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <span>{{ plugin.downloads }}</span>
                <span class="truncate text-xs">{{ formatMarketplaceDate(plugin.updatedAt) }}</span>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <n-button type="primary" size="small" :loading="isInstalling(plugin.id)" @click="handleMarketplaceInstall(plugin)">
                {{ getMarketplaceActionText(plugin) }}
              </n-button>
              <a
                v-if="plugin.homepage"
                :href="plugin.homepage"
                target="_blank"
                class="giopic-link-btn border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                {{ t('settings.plugins.homepage') }}
              </a>
            </div>
          </article>
        </div>

        <div v-else class="rounded-[24px] border border-dashed border-slate-300 bg-white py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div class="mb-3 flex justify-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/60">
              <div class="i-ph-storefront text-3xl text-slate-300 dark:text-slate-600" />
            </div>
          </div>
          <p class="font-medium text-slate-600 dark:text-slate-300">
            {{ marketPlugins.length === 0 ? t('settings.plugins.marketEmpty') : t('settings.plugins.marketNoMatches') }}
          </p>
          <p class="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {{ marketPlugins.length === 0 ? t('settings.plugins.marketEmptyDesc') : t('settings.plugins.marketNoMatchesDesc') }}
          </p>
        </div>
      </div>
    </section>

    <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFileSelect">

    <n-modal
      :show="Boolean(activeCodePlugin)"
      preset="card"
      :title="activeCodePlugin ? `${activeCodePlugin.name} · ${t('settings.plugins.viewCode')}` : t('settings.plugins.viewCode')"
      class="w-full max-w-4xl"
      :bordered="false"
      size="huge"
      @update:show="(value: boolean) => { if (!value) closeCodeModal() }"
    >
      <div class="space-y-4">
        <div class="flex justify-end">
          <n-button tertiary size="small" @click="copyCode">{{ t('common.copy') }}</n-button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1220] shadow-inner">
          <div class="flex items-center justify-between border-b border-slate-800 bg-[#111A2B] px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <span>plugin.json</span>
            <span>{{ activeCodePlugin?.version }}</span>
          </div>
          <pre class="max-h-[70vh] overflow-auto p-4 text-xs leading-6 text-slate-100"><code class="language-json">{{ activeCode }}</code></pre>
        </div>
      </div>
    </n-modal>

    <n-modal
      :show="Boolean(activeConfigPlugin)"
      preset="card"
      :title="activeConfigPlugin ? `${activeConfigPlugin.name} · ${t('settings.plugins.configure')}` : t('settings.plugins.configure')"
      class="w-full max-w-3xl"
      :bordered="false"
      @update:show="(value: boolean) => { if (!value) closeConfigModal() }"
    >
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {{ t('settings.plugins.configHelp') }}
        </div>
        <div v-if="activeConfigFields.length > 0" class="space-y-3">
          <div
            v-for="field in activeConfigFields"
            :key="field.name"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-semibold text-slate-900 dark:text-slate-100">{{ field.label }}</div>
              <div class="flex flex-wrap gap-2 text-xs">
                <span class="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-300">{{ field.name }}</span>
                <span class="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-300">{{ field.type }}</span>
                <span v-if="field.required" class="rounded-full bg-rose-100 px-2 py-1 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                  {{ t('settings.plugins.requiredField') }}
                </span>
              </div>
            </div>
            <div v-if="field.placeholder || field.help" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
              <div v-if="field.placeholder">{{ t('settings.plugins.fieldPlaceholder') }}: {{ field.placeholder }}</div>
              <div v-if="field.help">{{ t('settings.plugins.fieldHelp') }}: {{ field.help }}</div>
            </div>
          </div>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
          {{ t('settings.plugins.configEmpty') }}
        </div>
      </div>
    </n-modal>
  </div>
</template>
