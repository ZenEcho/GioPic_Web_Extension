<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useThemeStore } from '@/stores/theme'
import type { DriveConfig } from '@/types'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'

import ClassicHome from '@/views/home/ClassicHome.vue'
import ConsoleHome from '@/views/home/ConsoleHome.vue'
import CenterHome from '@/views/home/CenterHome.vue'
import SimpleHome from '@/views/home/SimpleHome.vue'
import ConfigModal from '@/components/config/ConfigModal.vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'

import ImportConfigModal from '@/components/home/sidebar/ImportConfigModal.vue'
import OnboardingOverlay from '@/components/home/onboarding/OnboardingOverlay.vue'
import { useUploadQueue } from '@/composables/useUploadQueue'
import { useConfigStore } from '@/stores/config'
import { useMessage } from 'naive-ui'

const themeStore = useThemeStore()
const configStore = useConfigStore()
const { t } = useI18n()
const message = useMessage()

// --- 状态定义 ---

const showAddModal = ref(false)
const showSettingsModal = ref(false)
const showOnboarding = ref(false)
const onboardingRef = ref<InstanceType<typeof OnboardingOverlay> | null>(null)
const isEdit = ref(false)
const currentConfig = ref<DriveConfig | null>(null)
const showImportModal = ref(false)
const importJson = ref('')

const isConfiguring = ref(false)

// --- 组合式函数 ---
const { fileQueue, addFileToQueue } = useUploadQueue()

// --- Event Handlers ---
function handleFilesDropped(files: File[]) {
    files.forEach(f => addFileToQueue(f))
}

function handleAddConfig() {
    currentConfig.value = null
    isEdit.value = false
    showAddModal.value = true
}

function handleEditConfig(config: DriveConfig) {
    currentConfig.value = config
    isEdit.value = true
    showAddModal.value = true
}

function handleOnboardingComplete() {
    showOnboarding.value = false
    browser.storage.local.set({ 'giopic-onboarding-completed': true })
}

function handleOnboardingCreateNode() {
    onboardingRef.value?.minimize()
    isConfiguring.value = true // 标记正在配置中
    showAddModal.value = true
}

function handleOnboardingImportNode() {
    showImportModal.value = true
    importJson.value = ''
    // 导入也属于配置过程，但导入弹窗是在引导层之上的，所以不需要隐藏引导
    // 如果导入弹窗被关闭，不需要特殊处理，因为引导层还在
}

function confirmImport() {
    try {
        const parsed = JSON.parse(importJson.value)
        const list = Array.isArray(parsed) ? parsed : [parsed]
        let count = 0
        list.forEach(item => {
            if (item && item.type && item.name) {
                const newConfig = {
                    ...item,
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9)
                }
                configStore.addConfig(newConfig)
                count++
            }
        })
        if (count > 0) {
            message.success(t('home.importSuccess', { count }))
            showImportModal.value = false
            // 导入成功后，可以认为配置完成
            onboardingRef.value?.celebrate()
            handleOnboardingComplete()
        } else {
            message.warning(t('home.importNoData'))
        }
    } catch (e) {
        message.error(t('home.importFailed'))
    }
}

function handleConfigSaved() {
    // 如果是从 onboarding 过来的，保存成功后结束 onboarding
    if (isConfiguring.value) {
        isConfiguring.value = false
        onboardingRef.value?.celebrate()
        handleOnboardingComplete()
    }
}

onMounted(async () => {
    const res = await browser.storage.local.get('giopic-onboarding-completed')
    if (!res['giopic-onboarding-completed']) {
        showOnboarding.value = true
    }
})
</script>

<template>
    <div class="h-full w-full overflow-hidden transition-colors duration-300 bg-[#F5F7FA] dark:bg-[#101014]">

        <ClassicHome v-if="themeStore.uiMode === 'classic'" :fileQueue="fileQueue" @filesDropped="handleFilesDropped"
            @addConfig="handleAddConfig" @editConfig="handleEditConfig" @openSettings="showSettingsModal = true" />

        <ConsoleHome v-else-if="themeStore.uiMode === 'console'" :fileQueue="fileQueue"
            @filesDropped="handleFilesDropped" @addConfig="handleAddConfig" @editConfig="handleEditConfig"
            @openSettings="showSettingsModal = true" />

        <CenterHome v-else-if="themeStore.uiMode === 'center'" :fileQueue="fileQueue" @filesDropped="handleFilesDropped"
            @addConfig="handleAddConfig" @editConfig="handleEditConfig" @openSettings="showSettingsModal = true" />

        <SimpleHome v-else-if="themeStore.uiMode === 'simple'" :fileQueue="fileQueue" @filesDropped="handleFilesDropped"
            @addConfig="handleAddConfig" @editConfig="handleEditConfig" @openSettings="showSettingsModal = true" />

        <ConfigModal v-model:show="showAddModal" :config="currentConfig" :isEdit="isEdit" @saved="handleConfigSaved"
            @update:show="(val) => {
                // 当 ConfigModal 关闭时（包括取消或点击遮罩关闭）
                if (!val && isConfiguring) {
                    // 恢复显示 Onboarding
                    isConfiguring = false
                    onboardingRef?.restore()
                }
            }" />

        <SettingsModal v-model:show="showSettingsModal" />

        <ImportConfigModal v-model:show="showImportModal" v-model:value="importJson" @confirm="confirmImport" />

        <OnboardingOverlay ref="onboardingRef" :show="showOnboarding" @complete="handleOnboardingComplete"
            @create-node="handleOnboardingCreateNode" @import-node="handleOnboardingImportNode" />
    </div>
</template>

