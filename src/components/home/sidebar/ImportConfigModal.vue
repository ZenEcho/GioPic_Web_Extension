<!--
 * Component Name: ImportConfigModal
 * Author: GioPic Team
 * Description: 配置导入模态框组件
 * 
 * Functional Domain:
 * Settings (设置) - 配置导入
 * 
 * Key Features:
 * - 文本导入：直接粘贴 JSON 配置文本
 * - 文件导入：上传 JSON/TXT 文件自动读取内容
 * - 格式验证：(在父组件或 confirm 事件中处理)
 * 
 * Props:
 * - show (boolean): 是否显示模态框
 * - value (string): 当前导入的配置文本内容
 * 
 * Events:
 * - update:show: 更新显示状态
 * - update:value: 更新文本内容
 * - confirm: 确认导入
 -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UploadFileInfo } from 'naive-ui'

defineProps<{
    show: boolean
    value: string
}>()

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void
    (e: 'update:value', value: string): void
    (e: 'confirm'): void
}>()

const { t } = useI18n()

const handleUpload = async (data: { file: UploadFileInfo }) => {
    const file = data.file.file
    if (file) {
        try {
            const text = await file.text()
            emit('update:value', text)
        } catch (e) {
            console.error('Failed to read file', e)
        }
    }
}
</script>

<template>
    <n-modal :show="show" @update:show="emit('update:show', $event)">
        <n-card style="width: 600px; max-width: 90vw;" :title="t('home.importTitle')" :bordered="false" size="huge"
            role="dialog" aria-modal="true">
            <div class="mb-3">
                <n-upload :show-file-list="false" accept=".json,.txt" @change="handleUpload" :default-upload="false">
                    <n-button secondary type="primary" size="small">
                        {{ t('home.selectFile') }}
                    </n-button>
                </n-upload>
            </div>
            <n-input :value="value" @update:value="emit('update:value', $event)" type="textarea"
                :placeholder="t('home.importPlaceholder')" :rows="10" />
            <template #footer>
                <div class="flex justify-end gap-2">
                    <n-button @click="emit('update:show', false)">{{ t('common.cancel') }}</n-button>
                    <n-button type="primary" @click="emit('confirm')">{{ t('common.confirm') }}</n-button>
                </div>
            </template>
        </n-card>
    </n-modal>
</template>
