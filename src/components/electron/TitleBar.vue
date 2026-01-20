<script setup lang="ts">
import { ref, computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from 'vue-i18n'

const themeStore = useThemeStore()
const { t } = useI18n()
const isMaximized = ref(false)

const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#ef4444')

const minimize = () => {
  window.ipcRenderer?.send('window-minimize')
}

const maximize = () => {
  window.ipcRenderer?.send('window-maximize')
  isMaximized.value = !isMaximized.value
}

const close = () => {
  window.ipcRenderer?.send('window-close')
}
</script>

<template>
  <div
    class="absolute top-0 right-0 left-0 h-10 flex justify-between items-center z-[9999] pointer-events-none select-none">
    <!-- Drag Region -->
    <div class="absolute inset-0 app-region-drag pointer-events-auto"></div>

    <!-- Left: Logo & Title -->
    <div class="flex items-center gap-2 pl-3 app-region-no-drag pointer-events-auto z-10 relative h-full">
      <div class="w-6 h-6 rounded-md flex items-center justify-center shadow-sm text-white ">
        <img src="@/assets/icons/logo64.png" alt="logo" class="h-4 w-4 object-contain">
      </div>
      <span class="text-xs font-black text-gray-700 dark:text-gray-200 tracking-wider">{{t('app.name')}} For {{t('app.nameSuffix')}}</span>
    </div>

    <!-- Right: Actions & Window Controls -->
    <div class="flex h-full items-center z-10 app-region-no-drag pointer-events-auto">

      <!-- Actions -->
      <div class="flex items-center gap-1 mr-2">
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all"
          @click="themeStore.toggleDark()"
          :title="themeStore.isDark ? t('settings.lightMode') : t('settings.darkMode')">
          <div class="text-lg" :class="themeStore.isDark ? 'i-ph-moon' : 'i-ph-sun'" />
        </button>
        <button
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all"
          @click="themeStore.showSettingsModal = true" :title="t('settings.title')">
          <div class="i-ph-gear text-lg" />
        </button>
      </div>

      <!-- Divider -->
      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mr-1"></div>

      <!-- Window Controls -->
      <button @click="minimize"
        class="w-10 h-full flex items-center justify-center hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
        <div class="i-ph-minus text-sm text-gray-500 dark:text-gray-400" />
      </button>

      <button @click="maximize"
        class="w-10 h-full flex items-center justify-center hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors">
        <div :class="isMaximized ? 'i-ph-squares-four' : 'i-ph-square'"
          class="text-sm text-gray-500 dark:text-gray-400" />
      </button>

      <button @click="close"
        class="w-10 h-full flex items-center justify-center hover:bg-[#e81123] hover:text-white transition-colors group rounded-tr-xl">
        <div class="i-ph-x text-lg text-gray-500 dark:text-gray-400 group-hover:text-white" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-region-drag {
  -webkit-app-region: drag;
}

.app-region-no-drag {
  -webkit-app-region: no-drag;
}

.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, v-bind(primaryColor), color-mix(in srgb, v-bind(primaryColor) 80%, black));
}

.text-primary {
  color: v-bind(primaryColor);
}

.hover\:text-primary:hover {
  color: v-bind(primaryColor);
}
</style>
