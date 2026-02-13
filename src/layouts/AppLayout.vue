<script setup lang="ts">
import { NConfigProvider, NGlobalStyle, NMessageProvider, NDialogProvider } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <n-config-provider :theme="themeStore.naiveTheme" :theme-overrides="themeStore.themeOverrides">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <div class=" bg-[#F5F7FA] dark:bg-[#101014] overflow-hidden transition-colors duration-300 min-h-[600px] min-w-[500px]">
             <slot />
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
