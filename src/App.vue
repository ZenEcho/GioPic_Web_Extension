<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
</script>

<template>
  <AppLayout class=" overflow-hidden">
    <RouterView />
  </AppLayout>
</template>
