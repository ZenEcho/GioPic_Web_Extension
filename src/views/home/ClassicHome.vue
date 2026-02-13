<script setup lang="ts">
import { useConfigStore } from '@/stores/config'
import type { DriveConfig } from '@/types'

import ClassicSidebar from '@/components/home/sidebar/ClassicSidebar.vue'
import UploadZone from '@/components/home/upload/UploadZone.vue'
import UploadQueue from '@/components/home/queue/UploadQueue.vue'
import { useUploadInput } from '@/composables/useUploadInput'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps<{
    fileQueue: any
}>()

const emit = defineEmits<{
    (e: 'filesDropped', files: File[]): void
    (e: 'addConfig'): void
    (e: 'editConfig', config: DriveConfig): void
    (e: 'openSettings'): void
}>()

const configStore = useConfigStore()

const { onFilesDropped } = useUploadInput((files) => {
    emit('filesDropped', files)
})
</script>

<template>
    <div class=" h-screen flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <!-- 左侧：分发节点 -->
        <ClassicSidebar v-model:selectedIds="configStore.selectedIds" @add="emit('addConfig')"
            @edit="(c) => emit('editConfig', c)" @openSettings="emit('openSettings')" />

        <!-- 中间：上传区域 -->
        <UploadZone @filesDropped="onFilesDropped" />

        <!-- 右侧：历史/结果 -->
        <UploadQueue class="m-4 md:m-6 mb-[86px]  md:w-[320px] "
            :uploadQueue="fileQueue.items" @upload-all="fileQueue.start()"
            @upload-item="(id: string) => fileQueue.trigger(id)" @retry-item="(id: string) => fileQueue.retry(id)"
            @remove-item="(id: string): void => fileQueue.remove(id)" @clear-all="fileQueue.clear()"
            @open-history="router.push('/history')" />
    </div>
</template>