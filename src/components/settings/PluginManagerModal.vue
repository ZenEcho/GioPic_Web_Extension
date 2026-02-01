<!--
 * Component Name: PluginManagerModal
 * Author: GioPic Team
 * Description: 插件管理模态框，允许用户导入、启用/禁用和删除自定义图床插件。
 * 
 * Functional Domain:
 * Settings (全局设置) - 插件管理
 * 
 * Key Features:
 * - 插件导入：支持从 JSON 文件导入符合规范的插件
 * - 状态管理：一键启用或禁用已安装的插件
 * - 插件信息展示：显示名称、版本、作者、主页等元数据
 * - 安全沙箱：插件代码将在隔离的 Sandbox 环境中运行（此组件仅负责管理配置）
 * 
 * Props:
 * - show (boolean): 模态框显示状态
 *  
 * Events:
 * - update:show: 更新显示状态
 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog } from 'naive-ui'
import { usePluginStore } from '@/stores/plugin'
import type { PluginMeta } from '@/types'

const props = defineProps<{
    show: boolean
}>()

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void
}>()

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const pluginStore = usePluginStore()

const fileInput = ref<HTMLInputElement | null>(null)

const handleImport = () => {
    fileInput.value?.click()
}

// 处理文件选择，解析并验证插件 JSON 格式
const onFileSelect = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
        const text = await file.text()
        const plugin = JSON.parse(text) as PluginMeta

        // 基础格式验证
        // Basic validation
        if (!plugin.id || !plugin.name || !plugin.version || !plugin.script) {
            throw new Error('Invalid plugin format')
        }

        await pluginStore.addPlugin(plugin)
        message.success(t('settings.plugins.importSuccess', { name: plugin.name }))
    } catch (err: any) {
        message.error(t('settings.plugins.importFailed') + ': ' + err.message)
    } finally {
        if (fileInput.value) fileInput.value.value = ''
    }
}

// 删除插件前的确认对话框
const handleDelete = (plugin: PluginMeta) => {
    dialog.warning({
        title: t('common.delete'),
        content: t('settings.plugins.deleteConfirm', { name: plugin.name }),
        positiveText: t('common.delete'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
            await pluginStore.removePlugin(plugin.id)
            message.success(t('common.success'))
        }
    })
}
</script>

<template>
    <n-modal :show="show" @update:show="(val: boolean) => emit('update:show', val)" preset="card"
        :title="t('settings.plugins.title')" class="w-full max-w-2xl" :bordered="false" size="huge">
        <div class="space-y-6">
            <!-- Header / Actions -->
            <div
                class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">
                    {{ t('settings.plugins.description') }}
                </p>
                <n-button type="primary" @click="handleImport" class="shrink-0 shadow-lg shadow-primary/20">
                    <template #icon>
                        <div class="i-ph-plus-bold" />
                    </template>
                    {{ t('settings.plugins.import') }}
                </n-button>
                <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFileSelect">
            </div>

            <!-- Plugin List -->
            <div class="space-y-3">
                <TransitionGroup name="list">
                    <div v-for="plugin in pluginStore.plugins" :key="plugin.id"
                        class="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/30 dark:hover:border-primary/30 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-none transition-all duration-300"
                        :class="{ 'opacity-60 grayscale': plugin.enabled === false }">
                        <!-- Icon -->
                        <div class="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-colors duration-300"
                            :class="plugin.enabled !== false ? 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'">
                            <img v-if="plugin.icon && plugin.icon.startsWith('http')" :src="plugin.icon"
                                class="w-8 h-8 object-contain" alt="icon" />
                            <div v-else :class="plugin.icon || 'i-ph-puzzle-piece-duotone'" />
                        </div>

                        <!-- Info -->
                        <div class="flex-1 min-w-0 w-full">
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="font-bold text-gray-900 dark:text-gray-100 truncate text-base">{{ plugin.name
                                    }}</h3>
                                <span
                                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">v{{
                                    plugin.version }}</span>
                            </div>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">{{ plugin.description }}
                            </p>
                            <div class="flex items-center gap-3 text-xs text-gray-400 font-mono flex-wrap">
                                <span class="flex items-center gap-1">
                                    <div class="i-ph-fingerprint" />
                                    {{ plugin.id }}
                                </span>
                                <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />

                                <component :is="plugin.authorUrl ? 'a' : 'span'" :href="plugin.authorUrl"
                                    target="_blank" class="flex items-center gap-1 transition-colors"
                                    :class="plugin.authorUrl ? 'hover:text-primary cursor-pointer' : ''">
                                    <div class="i-ph-user" />
                                    {{ plugin.author }}
                                </component>

                                <template v-if="plugin.homepage">
                                    <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                    <a :href="plugin.homepage" target="_blank"
                                        class="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                        :title="t('settings.plugins.homepage')">
                                        <div class="i-ph-house" />
                                        {{ t('settings.plugins.homepage') }}
                                    </a>
                                </template>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div
                            class="flex sm:flex-col md:flex-row items-center gap-3 w-full sm:w-auto justify-end sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700 sm:pl-4 sm:border-l">
                            <n-switch :value="plugin.enabled !== false"
                                @update:value="pluginStore.togglePlugin(plugin.id)" size="medium">
                                <template #checked-icon>
                                    <div class="i-ph-check" />
                                </template>
                                <template #unchecked-icon>
                                    <div class="i-ph-x" />
                                </template>
                            </n-switch>

                            <button
                                class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                :title="t('common.delete')" @click.stop="handleDelete(plugin)">
                                <div class="i-ph-trash-duotone text-xl" />
                            </button>
                        </div>
                    </div>
                </TransitionGroup>

                <div v-if="pluginStore.plugins.length === 0"
                    class="flex flex-col items-center justify-center py-12 text-center">
                    <div
                        class="w-24 h-24 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <div class="i-ph-puzzle-piece-duotone text-4xl text-gray-300 dark:text-gray-600" />
                    </div>
                    <p class="text-gray-500 font-medium mb-1">{{ t('settings.plugins.empty') }}</p>
                    <p class="text-sm text-gray-400">{{ t('settings.plugins.description') }}</p>
                </div>
            </div>
        </div>
    </n-modal>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
    transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: translateY(20px);
}
</style>
