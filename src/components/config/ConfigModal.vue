<!--
 * Component Name: ConfigModal
 * Author: GioPic Team
 * Description: 图床配置模态框组件，用于添加或编辑图床配置。
 * 
 * Functional Domain:
 * Config (配置模块) - 管理不同图床驱动的配置表单
 * 
 * Key Features:
 * - 分步向导：选择图床类型 -> 填写配置信息
 * - 动态表单：基于 Drive Schema 动态渲染配置项
 * - 验证集成：自动生成表单验证规则
 * - 高级配置：支持 CORS 和 ACL 设置（针对特定图床）
 * 
 * Props:
 * - show (boolean): 控制模态框的显示与隐藏
 * - config (DriveConfig | null): 编辑模式下的现有配置对象
 * - isEdit (boolean): 是否为编辑模式
 * 
 * Events:
 * - update:show: 更新显示状态
 * - saved: 配置保存成功时触发
 -->

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { useDriveRegistry } from '@/composables/useDriveRegistry'

import type { DriveConfig } from '@/types'
import DynamicConfigForm from './DynamicConfigForm.vue'
import CorsConfig from './CorsConfig.vue'
import AclConfig from './AclConfig.vue'
import { hasFieldValue, isFieldDisabled, isFieldVisible } from '@/utils/pluginForm'

// 定义组件 Props
const props = defineProps<{
  show: boolean
  config?: DriveConfig | null
  isEdit: boolean
}>()

// 定义组件 Events
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const message = useMessage()
const formRef = ref()
// 使用组合式函数获取图床注册表和 Schema 获取器
const { getDriveSchema, registry } = useDriveRegistry()

// 表单默认值
const defaultForm: any = {
  id: '',
  name: '',
  type: '', 
  enabled: true,
}

// 表单数据模型
const formModel = ref({ ...defaultForm })
// 当前步骤：0 = 选择类型, 1 = 填写配置
const currentStep = ref(0) 

// 根据选择的类型获取当前的配置 Schema
const currentSchema = computed(() => {
    return getDriveSchema(formModel.value.type)
})

function buildRequiredRule() {
    return {
        validator: (_rule: any, value: any, callback: (error?: Error) => void) => {
            if (hasFieldValue(value)) {
                callback()
                return
            }

            callback(new Error(t('config.validation.required')))
        },
        trigger: ['blur', 'change']
    }
}

// 基于 Schema 动态生成表单验证规则
const rules = computed(() => {
    const baseRules: any = {
        name: buildRequiredRule(),
        type: buildRequiredRule(),
    }
    
    // 添加 Schema 中定义的必填规则
    currentSchema.value.forEach(field => {
        if (!field.required) {
            return
        }

        baseRules[field.key] = {
            validator: (_rule: any, value: any, callback: (error?: Error) => void) => {
                if (!isFieldVisible(field, formModel.value) || isFieldDisabled(field, formModel.value)) {
                    callback()
                    return
                }

                if (hasFieldValue(value)) {
                    callback()
                    return
                }

                callback(new Error(t('config.validation.required')))
            },
            trigger: ['blur', 'change']
        }
    })
    
    return baseRules
})

// 监听显示状态变化，重置或填充表单
watch(() => props.show, (newVal) => {
    if (newVal) {
        if (props.isEdit && props.config) {
            // 编辑模式：填充现有配置，直接进入步骤 1
            formModel.value = { ...defaultForm, ...props.config }
            currentStep.value = 1
        } else {
            // 新增模式：重置表单，进入步骤 0
            formModel.value = { ...defaultForm }
            currentStep.value = 0
        }
    }
})

// 监听类型变化，应用默认值
watch(() => formModel.value.type, (newType) => {
    if (newType && !props.isEdit && props.show) {
        applyDefaults()
    }
})

// 应用 Schema 中定义的默认值
function applyDefaults() {
    const schema = getDriveSchema(formModel.value.type)
    if (!schema) return
    
    schema.forEach(field => {
        if (field.defaultValue !== undefined) {
            formModel.value[field.key] = field.defaultValue
        }
    })
}

// 处理类型选择
function handleSelectType(type: string) {
    formModel.value.type = type
    currentStep.value = 1
}

// 返回上一步（重新选择类型）
function handleBack() {
    currentStep.value = 0
}

// 保存配置
function handleSaveConfig() {
  formRef.value?.validate((errors: any) => {
    if (!errors) {
      const config = { ...formModel.value }
      if (props.isEdit) {
        // 更新现有配置
        configStore.updateConfig(config.id, config as DriveConfig)
        message.success(t('common.success'))
      } else {
        // 添加新配置
        config.id = Date.now().toString()
        configStore.addConfig(config as DriveConfig)
        message.success(t('common.success'))
      }
      emit('saved')
      emit('update:show', false)
    } else {
      message.error(t('common.error'))
    }
  })
}

// 关闭模态框
function handleClose() {
    emit('update:show', false)
}

// 获取图床类型的显示名称
function getDriveLabel(value: string) {
    const item = registry.value[value]
    return item ? item.label : value
}
</script>

<template>
    <n-modal 
        :show="show" 
        @update:show="(val: boolean) => emit('update:show', val)"
        preset="card" 
        :title="isEdit ? t('config.editTitle') : (currentStep === 0 ? t('config.selectType') : t('config.addTitle'))" 
        class="w-full max-w-4xl rounded-[24px] overflow-hidden shadow-xl" 
        :segmented="true"
        :header-style="{ padding: '20px 24px', borderBottom: '1px solid var(--n-border-color)' }"
        :content-style="{ padding: '0' }"
        :footer-style="{ padding: '16px 24px', borderTop: '1px solid var(--n-border-color)' }"
    >
        <!-- 步骤 0: 选择图床类型 -->
        <DriveSelector 
            v-if="currentStep === 0"
            v-model="formModel.type"
            @select="handleSelectType"
        />

        <!-- 步骤 1: 配置表单 -->
        <div v-else class="p-6">
            <n-form ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="medium">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <!-- 配置名称 -->
                    <n-form-item :label="t('config.form.name')" path="name">
                        <n-input v-model:value="formModel.name" :placeholder="t('config.form.namePlaceholder')" />
                    </n-form-item>
                    <!-- 图床类型展示与更改 -->
                    <n-form-item :label="t('config.form.type')" path="type">
                        <div class="w-full flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                             <div class="w-8 h-8 rounded bg-white dark:bg-gray-700 flex items-center justify-center font-bold text-primary shadow-sm">
                                {{ formModel.type.charAt(0).toUpperCase() }}
                             </div>
                             <span class="font-medium">{{ getDriveLabel(formModel.type) }}</span>
                             <button v-if="!isEdit" @click="handleBack" class="ml-auto text-xs text-primary hover:underline px-2">
                                {{ t('common.change') }}
                             </button>
                        </div>
                    </n-form-item>
                </div>

                <div class="border-t border-gray-100 dark:border-gray-700 my-4 pt-4">
                    <!-- 动态表单区域 -->
                    <DynamicConfigForm 
                        :schema="currentSchema"
                        v-model="formModel"
                    />
                </div>

                <!-- 特定图床的高级配置 (CORS, ACL) -->
                <div v-if="(formModel.type === 'aliyun' || formModel.type === 'tencent' || formModel.type === 'aws') && isEdit" 
                     class="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
                    <CorsConfig 
                        :config="formModel"
                        :type="formModel.type"
                    />

                    <AclConfig 
                        :config="formModel"
                        :type="formModel.type"
                    />
                </div>
            </n-form>
        </div>

      <!-- 底部按钮区域 -->
      <template #footer>
        <div class="flex justify-between items-center w-full">
            <div v-if="currentStep === 1 && !isEdit">
                 <button @click="handleBack" 
                    class="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    <div class="i-ph-arrow-left" />
                    {{ t('common.back') }}
                </button>
            </div>
            <div v-else></div> <!-- 占位符 -->

            <div class="flex gap-3">
                <button @click="handleClose" 
                    class="giopic-link-btn px-4 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
                    {{ t('common.cancel') }}
                </button>
                <button v-if="currentStep === 1" @click="handleSaveConfig" 
                    class="giopic-link-btn px-6 h-9 rounded-lg text-white hover:opacity-90 font-medium transition-opacity shadow-sm"
                    :style="{ backgroundColor: 'var(--giopic-primary)' }"
                >
                    {{ t('common.save') }}
                </button>
            </div>
        </div>
      </template>
    </n-modal>
</template>


