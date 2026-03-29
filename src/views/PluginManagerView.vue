<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PluginManagerPanel from '@/components/settings/PluginManagerPanel.vue'

const { t } = useI18n()
const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.push('/')
}
</script>

<template>
  <div class="bg-[#F5F7FA] dark:bg-[#101014] min-h-[calc(100vh-64px)] p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex items-center gap-4">
        <button
          class="giopic-icon-btn w-10 h-10 bg-white dark:text-gray-100 dark:bg-gray-600 border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:text-primary transition-all shadow-sm hover:shadow-md"
          :title="t('common.back')"
          @click="goBack"
        >
          <div class="i-ph-arrow-left text-xl" />
        </button>
        <h1 class="text-2xl font-black text-gray-800 dark:text-white leading-none">
          {{ t('settings.plugins.title') }}
        </h1>
      </div>

      <div class="rounded-[24px] border border-gray-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/50 p-4 md:p-6 shadow-sm backdrop-blur-sm">
        <PluginManagerPanel />
      </div>
    </div>
  </div>
</template>
