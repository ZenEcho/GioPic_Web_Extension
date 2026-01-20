<script setup lang="ts">
import { NConfigProvider, NGlobalStyle, NMessageProvider, NDialogProvider } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'
import TitleBar from '@/components/electron/TitleBar.vue'

const themeStore = useThemeStore()
const isElectron = window.ipcRenderer !== undefined
</script>

<template>
  <n-config-provider :theme="themeStore.naiveTheme" :theme-overrides="themeStore.themeOverrides">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <div
          class="h-screen w-screen bg-[#F5F7FA] dark:bg-[#101014] overflow-hidden transition-colors duration-300  relative">
          <TitleBar v-if="isElectron" />
          <div class="h-full w-full overflow-hidden">
            <slot />
          </div>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
