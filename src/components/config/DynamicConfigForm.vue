<!--
 * Component Name: DynamicConfigForm
 * Author: GioPic Team
 * Description: 动态配置表单组件，根据驱动 Schema 自动渲染表单项。
 * 
 * Functional Domain:
 * Config (配置模块) - 核心表单渲染引擎
 * 
 * Key Features:
 * - 动态渲染：支持 text, password, select, textarea, kv-pairs, switch 等多种字段类型
 * - 魔术变量预览：实时演示 {uuid}, {year} 等变量的替换结果
 * - Lsky Pro 集成：自动获取 Lsky Pro 的存储策略和相册列表
 * - 国际化支持：自动处理标签和占位符的翻译
 * 
 * Props:
 * - schema (FieldSchema[]): 表单字段定义数组
 * - modelValue (Record<string, any>): 表单数据模型
 * 
 * Events:
 * - update:modelValue: 更新表单数据
 -->

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FieldSchema } from '@/constants/driveSchemas'
import { fetchLskyStrategies, fetchLskyAlbums } from '@/services/uploader'
import { replaceMagicVariables } from '@/utils/variables'
import { useMessage, NCollapse, NCollapseItem } from 'naive-ui'
import KvInput from './KvInput.vue'

// 定义组件 Props
const props = defineProps<{
    schema: FieldSchema[]
    modelValue: Record<string, any>
}>()

// 定义组件 Events
const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, any>): void
}>()

const { t } = useI18n()
const message = useMessage()
// Lsky Pro 策略选项
const strategyOptions = ref<{ label: string, value: string | number }[]>([])
const loadingStrategies = ref(false)
// Lsky Pro 相册选项
const albumOptions = ref<{ label: string, value: string | number }[]>([])
const loadingAlbums = ref(false)

// 用于预览魔术变量的模拟文件
const mockFile = new File([''], 'example.png', { type: 'image/png' })

// 计算魔术变量的预览值
const previewValues = computed(() => {
    return {
        filename: replaceMagicVariables('{filename}', mockFile),
        name: replaceMagicVariables('{name}', mockFile),
        ext: replaceMagicVariables('{ext}', mockFile),
        year: replaceMagicVariables('{year}', mockFile),
        month: replaceMagicVariables('{month}', mockFile),
        day: replaceMagicVariables('{day}', mockFile),
        timestamp: replaceMagicVariables('{timestamp}', mockFile),
        random: replaceMagicVariables('{random}', mockFile),
        uuid: replaceMagicVariables('{uuid}', mockFile),
    }
})

// 监听 Lsky Pro 配置变化，自动加载策略和相册
watch(() => [props.modelValue.type, props.modelValue.apiUrl, props.modelValue.token, props.modelValue.version], async ([type, apiUrl, token, version], oldValue) => {
    const [oldType, oldApiUrl, oldToken, oldVersion] = oldValue || []
    if (type === 'lsky' && apiUrl && token) {
        // 仅在关键字段变化时重新加载，避免不必要的请求
        if (apiUrl !== oldApiUrl || token !== oldToken || version !== oldVersion) {
            await Promise.all([
                loadStrategies(apiUrl, token, version),
                loadAlbums(apiUrl, token, version)
            ])
        }
    } else {
        // 非 Lsky Pro 类型或配置不完整时清空选项
        strategyOptions.value = []
        albumOptions.value = []
    }
}, { immediate: true })

// 加载 Lsky Pro 存储策略
async function loadStrategies(apiUrl: string, token: string, version: any) {
    loadingStrategies.value = true
    try {
        const strategies = await fetchLskyStrategies(apiUrl, token, version || 'v1')
        strategyOptions.value = strategies.map(s => ({
            label: s.name,
            value: s.id
        }))

    } catch (e) {
        // 静默失败或仅在控制台记录错误
        console.error(e)
    } finally {
        loadingStrategies.value = false
    }
}

// 加载 Lsky Pro 相册列表
async function loadAlbums(apiUrl: string, token: string, version: any) {
    loadingAlbums.value = true
    try {
        const albums = await fetchLskyAlbums(apiUrl, token, version || 'v1')
        albumOptions.value = albums.map(a => ({
            label: a.name,
            value: a.id
        }))
    } catch (e) {
        console.error(e)
    } finally {
        loadingAlbums.value = false
    }
}

// 辅助函数：获取翻译后的标签
// 如果标签包含点号，尝试作为 i18n key 翻译；否则直接返回
function getLabel(label: string) {
    if (label && label.includes('.')) {
        return t(label)
    }
    return label
}

// 辅助函数：获取翻译后的占位符
function getPlaceholder(placeholder: string | undefined) {
    if (!placeholder) return ''
    if (placeholder.includes('.')) {
        return t(placeholder)
    }
    return placeholder
}

// 辅助函数：处理选项列表的翻译
function getOptions(options: { label: string; value: string }[] | undefined) {
    if (!options) return []
    return options.map(opt => ({
        ...opt,
        label: getLabel(opt.label)
    }))
}

// 更新表单字段值
function updateField(key: string, value: any) {
    emit('update:modelValue', {
        ...props.modelValue,
        [key]: value
    })
}
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <!-- 自定义图床显示魔术变量预览面板 -->
        <div v-if="modelValue.type === 'custom'" class="md:col-span-2 mb-4">
            <n-collapse>
                <n-collapse-item :title="t('config.form.magicVariable.title')" name="1">
                    <div class="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <!-- 变量预览列表 -->
                        <div><code>{filename}</code>: {{ t('config.form.magicVariable.filename') }}
                            <n-ellipsis class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.filename }}
                            </n-ellipsis>
                        </div>
                        <div><code>{name}</code>: {{ t('config.form.magicVariable.name') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.name }}
                            </n-ellipsis></div>
                        <div><code>{ext}</code>: {{ t('config.form.magicVariable.ext') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.ext }}
                            </n-ellipsis></div>
                        <div><code>{year}</code>: {{ t('config.form.magicVariable.year') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.year }}
                            </n-ellipsis></div>
                        <div><code>{month}</code>: {{ t('config.form.magicVariable.month') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.month }}
                            </n-ellipsis></div>
                        <div><code>{day}</code>: {{ t('config.form.magicVariable.day') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.day }}
                            </n-ellipsis></div>
                        <div><code>{timestamp}</code>: {{ t('config.form.magicVariable.timestamp') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.timestamp }}
                            </n-ellipsis></div>
                        <div><code>{random}</code>: {{ t('config.form.magicVariable.random') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.random }}
                            </n-ellipsis></div>
                        <div><code>{uuid}</code>: {{ t('config.form.magicVariable.uuid') }} <n-ellipsis
                                class="text-gray-400" style="max-width: 128px">
                                {{ previewValues.uuid }}
                            </n-ellipsis></div>
                    </div>
                </n-collapse-item>
            </n-collapse>
        </div>
        
        <!-- 循环渲染 Schema 定义的字段 -->
        <template v-for="field in schema" :key="field.key">
            <n-form-item :label="getLabel(field.label)" :path="field.key"
                :class="{ 'md:col-span-2': field.type === 'textarea' || field.type === 'kv-pairs' }">
                
                <!-- 文本/密码输入框 -->
                <n-input v-if="field.type === 'text' || field.type === 'password'" :value="modelValue[field.key]"
                    @update:value="(val: string | number) => updateField(field.key, val)"
                    :type="field.type === 'password' ? 'password' : 'text'"
                    :show-password-on="field.type === 'password' ? 'click' : undefined"
                    :placeholder="getPlaceholder(field.placeholder)" />
                
                <!-- 下拉选择框 (通用) -->
                <n-select
                    v-else-if="field.type === 'select' && field.key !== 'strategyId' && !(field.key === 'albumId' && modelValue.type === 'lsky')"
                    :value="modelValue[field.key] || field.defaultValue"
                    @update:value="(val: string | number) => updateField(field.key, val)" :options="getOptions(field.options)" />

                <!-- 特殊处理：Lsky Pro 策略 ID 选择 -->
                <n-select v-else-if="field.key === 'strategyId' && modelValue.type === 'lsky'"
                    :value="modelValue[field.key]" @update:value="(val: string | number) => updateField(field.key, val)"
                    :options="strategyOptions" :loading="loadingStrategies"
                    :placeholder="t('config.form.strategyIdPlaceholder')" filterable tag />

                <!-- 特殊处理：Lsky Pro 相册 ID 选择 -->
                <n-select v-else-if="field.key === 'albumId' && modelValue.type === 'lsky'"
                    :value="modelValue[field.key]" @update:value="(val: string | number) => updateField(field.key, val)"
                    :options="albumOptions" :loading="loadingAlbums"
                    :placeholder="getPlaceholder(field.placeholder)"
                    filterable clearable tag />

                <!-- 策略 ID 输入 (非 Lsky Pro) -->
                <n-input v-else-if="field.key === 'strategyId' && modelValue.type !== 'lsky'"
                    :value="modelValue[field.key]" @update:value="(val: string | number) => updateField(field.key, val)"
                    :placeholder="getPlaceholder(field.placeholder)" />

                <!-- 多行文本框 -->
                <n-input v-else-if="field.type === 'textarea'" :value="modelValue[field.key]"
                    @update:value="(val: string | number) => updateField(field.key, val)" type="textarea"
                    :placeholder="getPlaceholder(field.placeholder)"
                    :autosize="{ minRows: 3, maxRows: 6 }" />

                <!-- 键值对输入框 (自定义请求头/参数) -->
                <KvInput v-else-if="field.type === 'kv-pairs'" :value="modelValue[field.key]"
                    @update:value="(val: string) => updateField(field.key, val)" />

                <!-- 开关 -->
                <n-switch v-else-if="field.type === 'checkbox' || field.type === 'switch'"
                    :value="modelValue[field.key] !== undefined ? modelValue[field.key] : field.defaultValue"
                    @update:value="(val: boolean) => updateField(field.key, val)">
                    <template #checked>
                        {{ t('common.yes') }}
                    </template>
                    <template #unchecked>
                        {{ t('common.no') }}
                    </template>
                </n-switch>

            </n-form-item>
        </template>
    </div>
</template>
