<!--
 * Component Name: DynamicConfigForm
 * Author: GioPic Team
 * Description: 动态配置表单组件，根据驱动 Schema 自动渲染表单项。
 * 
 * Functional Domain:
 * Config (配置模块) - 核心表单渲染引擎
 * 
 * Key Features:
 * - 动态渲染：支持 text, password, number, select, textarea, kv-pairs, switch 等字段类型
 * - 动态数据源：支持字段级联、远程拉取选项、脚本回填
 * - 魔术变量预览：实时演示 {uuid}, {year} 等变量的替换结果
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
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BuiltinFieldLoader, FieldSchema } from '@/constants/driveSchemas'
import { fetchLskyAlbums, fetchLskyStrategies } from '@/services/uploader'
import { runPluginConfigScript } from '@/services/pluginRunner'
import { replaceMagicVariables } from '@/utils/variables'
import { hasFieldValue, isFieldDisabled as matchFieldDisabled, isFieldVisible as matchFieldVisible, normalizeDataSourceResult } from '@/utils/pluginForm'
import { NCollapse, NCollapseItem } from 'naive-ui'
import KvInput from './KvInput.vue'

interface DynamicFieldState {
    options: { label: string, value: any }[]
    loading: boolean
    error: string
    help?: string
    placeholder?: string
    touched: boolean
}

const props = defineProps<{
    schema: FieldSchema[]
    modelValue: Record<string, any>
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, any>): void
}>()

const { t } = useI18n()
const dynamicFieldStates = reactive<Record<string, DynamicFieldState>>({})
const dynamicSignatures = new Map<string, string>()
const dynamicRequestTokens = new Map<string, number>()
const dynamicDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const FIELD_SOURCE_DEBOUNCE_MS = 400

const builtinLoaders: Record<BuiltinFieldLoader, (config: Record<string, any>) => Promise<unknown>> = {
    lskyStrategies: async (config) => {
        const strategies = await fetchLskyStrategies(config.apiUrl, config.token, config.version || 'v1')
        return {
            options: strategies.map(item => ({
                label: item.name,
                value: item.id,
            }))
        }
    },
    lskyAlbums: async (config) => {
        const albums = await fetchLskyAlbums(config.apiUrl, config.token, config.version || 'v1')
        return {
            options: albums.map(item => ({
                label: item.name,
                value: item.id,
            }))
        }
    }
}

function ensureFieldState(key: string): DynamicFieldState {
    if (!dynamicFieldStates[key]) {
        dynamicFieldStates[key] = {
            options: [],
            loading: false,
            error: '',
            touched: false,
        }
    }

    return dynamicFieldStates[key]
}

function resetFieldState(key: string) {
    const state = ensureFieldState(key)
    state.options = []
    state.loading = false
    state.error = ''
    state.help = undefined
    state.placeholder = undefined
    state.touched = false
}

function cleanupDynamicFieldStates(activeKeys: string[]) {
    const activeKeySet = new Set(activeKeys)
    Object.keys(dynamicFieldStates).forEach((key) => {
        if (activeKeySet.has(key)) {
            return
        }

        delete dynamicFieldStates[key]
        dynamicSignatures.delete(key)
        dynamicRequestTokens.delete(key)
        const timer = dynamicDebounceTimers.get(key)
        if (timer !== undefined) {
            clearTimeout(timer)
            dynamicDebounceTimers.delete(key)
        }
    })
}

function clearFieldSourceDebounce(key: string) {
    const timer = dynamicDebounceTimers.get(key)
    if (timer === undefined) {
        return
    }

    clearTimeout(timer)
    dynamicDebounceTimers.delete(key)
}

function normalizeDependencyKeys(rawDependencies: unknown): string[] {
    if (Array.isArray(rawDependencies)) {
        return Array.from(
            new Set(
                rawDependencies
                    .filter((item): item is string => typeof item === 'string')
                    .map(item => item.trim())
                    .filter(item => item.length > 0)
            )
        )
    }

    if (typeof rawDependencies === 'string') {
        return Array.from(
            new Set(
                rawDependencies
                    .split(',')
                    .map(item => item.trim())
                    .filter(item => item.length > 0)
            )
        )
    }

    return []
}

function getFieldWatchDependencies(field: FieldSchema): string[] {
    return normalizeDependencyKeys(field.dataSource?.watch)
}

function getFieldRequiredDependencies(field: FieldSchema): string[] {
    const requiredDependencies = normalizeDependencyKeys(field.dataSource?.required)
    if (requiredDependencies.length > 0) {
        return requiredDependencies
    }

    return getFieldWatchDependencies(field)
}

function isFieldSourceManual(field: FieldSchema): boolean {
    return field.dataSource?.manual === true
}

function getFieldDependencies(field: FieldSchema): string[] {
    const watchDependencies = getFieldWatchDependencies(field)
    if (watchDependencies.length > 0) {
        return watchDependencies
    }

    return getFieldRequiredDependencies(field)
}

function canResolveFieldSource(field: FieldSchema): boolean {
    if (!field.dataSource) {
        return false
    }

    if (!isFieldVisible(field)) {
        return false
    }

    return getFieldRequiredDependencies(field).every(key => hasFieldValue(props.modelValue[key]))
}

function getFieldSourceSignature(field: FieldSchema): string {
    const source = field.dataSource
    if (!source) {
        return ''
    }

    const dependencies = getFieldDependencies(field)
    const watchDependencies = getFieldWatchDependencies(field)
    const requiredDependencies = getFieldRequiredDependencies(field)
    return JSON.stringify({
        key: field.key,
        visible: isFieldVisible(field),
        loader: source.loader || '',
        script: source.script || '',
        manual: isFieldSourceManual(field),
        watch: watchDependencies,
        required: requiredDependencies,
        canResolve: canResolveFieldSource(field),
        dependencies: dependencies.map(key => [key, props.modelValue[key]]),
    })
}

function updateField(key: string, value: any) {
    emit('update:modelValue', {
        ...props.modelValue,
        [key]: value
    })
}

function patchModel(patch: Record<string, any>) {
    const nextModel = { ...props.modelValue }
    let changed = false

    Object.entries(patch).forEach(([key, value]) => {
        if (nextModel[key] === value) {
            return
        }
        nextModel[key] = value
        changed = true
    })

    if (changed) {
        emit('update:modelValue', nextModel)
    }
}

async function resolveFieldSource(field: FieldSchema) {
    const source = field.dataSource
    if (!source || !canResolveFieldSource(field)) {
        resetFieldState(field.key)
        return
    }

    const state = ensureFieldState(field.key)
    const requestToken = (dynamicRequestTokens.get(field.key) || 0) + 1
    dynamicRequestTokens.set(field.key, requestToken)

    state.loading = true
    state.error = ''

    try {
        const rawResult = source.loader
            ? await builtinLoaders[source.loader]({ ...props.modelValue })
            : await runPluginConfigScript(source.script || '', { ...props.modelValue })

        if (dynamicRequestTokens.get(field.key) !== requestToken) {
            return
        }

        const normalizedResult = normalizeDataSourceResult(rawResult)
        state.options = normalizedResult.options || []
        state.help = normalizedResult.help
        state.placeholder = normalizedResult.placeholder
        state.error = ''
        state.touched = true

        const patch: Record<string, any> = {
            ...(normalizedResult.patch || {})
        }
        if (normalizedResult.value !== undefined) {
            patch[field.key] = normalizedResult.value
        }
        if (Object.keys(patch).length > 0) {
            patchModel(patch)
        }
    } catch (error: any) {
        if (dynamicRequestTokens.get(field.key) !== requestToken) {
            return
        }

        state.error = error?.message || 'Failed to load field data'
        state.options = []
        state.touched = true
    } finally {
        if (dynamicRequestTokens.get(field.key) === requestToken) {
            state.loading = false
        }
    }
}

function scheduleResolveFieldSource(field: FieldSchema, immediate = false) {
    clearFieldSourceDebounce(field.key)

    if (immediate) {
        void resolveFieldSource(field)
        return
    }

    const timer = setTimeout(() => {
        dynamicDebounceTimers.delete(field.key)
        void resolveFieldSource(field)
    }, FIELD_SOURCE_DEBOUNCE_MS)
    dynamicDebounceTimers.set(field.key, timer)
}

function refreshFieldSource(field: FieldSchema) {
    if (!field.dataSource) {
        return
    }

    scheduleResolveFieldSource(field, true)
}

function getFieldState(key: string) {
    return ensureFieldState(key)
}

function isFieldVisible(field: FieldSchema) {
    return matchFieldVisible(field, props.modelValue)
}

function isFieldDisabled(field: FieldSchema) {
    return matchFieldDisabled(field, props.modelValue)
}

function getLabel(label: string) {
    if (label && label.includes('.')) {
        return t(label)
    }
    return label
}

function getPlaceholder(placeholder: string | undefined) {
    if (!placeholder) return ''
    if (placeholder.includes('.')) {
        return t(placeholder)
    }
    return placeholder
}

function getOptions(options: { label: string; value: any }[] | undefined) {
    if (!options) return []
    return options.map(opt => ({
        ...opt,
        label: getLabel(opt.label)
    }))
}

function getFieldOptions(field: FieldSchema) {
    const state = getFieldState(field.key)
    return state.touched ? getOptions(state.options) : getOptions(field.options)
}

function getFieldHelp(field: FieldSchema) {
    const state = getFieldState(field.key)
    return state.help || field.help || ''
}

function getFieldPlaceholder(field: FieldSchema) {
    const state = getFieldState(field.key)
    return getPlaceholder(state.placeholder || field.placeholder)
}

function getFieldRefreshLabel(field: FieldSchema) {
    return field.dataSource?.actionLabel || t('home.refresh')
}

const mockFile = new File([''], 'example.png', { type: 'image/png' })

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

watch(() => props.schema
    .filter(field => field.dataSource)
    .map(field => ({
        key: field.key,
        signature: getFieldSourceSignature(field),
        manual: isFieldSourceManual(field),
        canResolve: canResolveFieldSource(field),
    })), (items) => {
        cleanupDynamicFieldStates(items.map(item => item.key))

        items.forEach((item) => {
            const field = props.schema.find(entry => entry.key === item.key)
            if (!field?.dataSource) {
                return
            }

            if (dynamicSignatures.get(item.key) === item.signature) {
                return
            }

            dynamicSignatures.set(item.key, item.signature)
            resetFieldState(item.key)

            if (!item.canResolve || item.manual) {
                clearFieldSourceDebounce(item.key)
                return
            }

            scheduleResolveFieldSource(field)
        })
    }, { immediate: true, deep: true })
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <div v-if="modelValue.type === 'custom'" class="md:col-span-2 mb-4">
            <n-collapse>
                <n-collapse-item :title="t('config.form.magicVariable.title')" name="1">
                    <div class="grid grid-cols-2 gap-2 text-xs text-gray-500">
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
        
        <template v-for="field in schema" :key="field.key">
            <n-form-item v-if="isFieldVisible(field)" :label="getLabel(field.label)" :path="field.key"
                :class="{ 'md:col-span-2': field.type === 'textarea' || field.type === 'kv-pairs' }">
                <div class="w-full space-y-1">
                    <n-input v-if="field.type === 'text' || field.type === 'password'" :value="modelValue[field.key]"
                        @update:value="(val: string | number) => updateField(field.key, val)"
                        :type="field.type === 'password' ? 'password' : 'text'"
                        :show-password-on="field.type === 'password' ? 'click' : undefined"
                        :placeholder="getFieldPlaceholder(field)" :disabled="isFieldDisabled(field)" />

                    <n-input-number v-else-if="field.type === 'number'" class="w-full"
                        :value="modelValue[field.key] ?? field.defaultValue"
                        @update:value="(val: number | null) => updateField(field.key, val)"
                        :placeholder="getFieldPlaceholder(field)" :disabled="isFieldDisabled(field)" />
                    
                    <n-select v-else-if="field.type === 'select'"
                        :value="modelValue[field.key] ?? field.defaultValue"
                        @update:value="(val: string | number | boolean | Array<string | number | boolean>) => updateField(field.key, val)"
                        :options="getFieldOptions(field)" :loading="getFieldState(field.key).loading"
                        :placeholder="getFieldPlaceholder(field)"
                        :filterable="field.filterable || !!field.dataSource"
                        :clearable="field.clearable"
                        :tag="field.tag"
                        :multiple="field.multiple"
                        :disabled="isFieldDisabled(field)" />

                    <n-input v-else-if="field.type === 'textarea'" :value="modelValue[field.key]"
                        @update:value="(val: string | number) => updateField(field.key, val)" type="textarea"
                        :placeholder="getFieldPlaceholder(field)"
                        :autosize="{ minRows: 3, maxRows: 6 }" :disabled="isFieldDisabled(field)" />

                    <KvInput v-else-if="field.type === 'kv-pairs'" :value="modelValue[field.key]"
                        @update:value="(val: string) => updateField(field.key, val)" :disabled="isFieldDisabled(field)" />

                    <n-checkbox v-else-if="field.type === 'checkbox'"
                        :checked="modelValue[field.key] !== undefined ? modelValue[field.key] : field.defaultValue"
                        @update:checked="(val: boolean) => updateField(field.key, val)"
                        :disabled="isFieldDisabled(field)" />

                    <n-switch v-else-if="field.type === 'switch'"
                        :value="modelValue[field.key] !== undefined ? modelValue[field.key] : field.defaultValue"
                        @update:value="(val: boolean) => updateField(field.key, val)"
                        :disabled="isFieldDisabled(field)">
                        <template #checked>
                            {{ t('common.yes') }}
                        </template>
                        <template #unchecked>
                            {{ t('common.no') }}
                        </template>
                    </n-switch>

                    <div v-if="field.dataSource" class="flex items-center justify-between gap-3 text-xs">
                        <div class="min-h-[18px] text-red-500 break-words">
                            {{ getFieldState(field.key).error }}
                        </div>
                        <n-button quaternary size="tiny" :loading="getFieldState(field.key).loading"
                            :disabled="!canResolveFieldSource(field)" @click="refreshFieldSource(field)">
                            {{ getFieldRefreshLabel(field) }}
                        </n-button>
                    </div>

                    <div v-if="getFieldHelp(field)" class="text-xs text-gray-500 whitespace-pre-wrap break-words leading-snug">{{ getFieldHelp(field) }}</div>
                </div>
            </n-form-item>
        </template>
    </div>
</template>

