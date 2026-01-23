<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'

import type { DriveConfig } from '@/types'
import { DRIVE_SCHEMAS, DRIVE_TYPE_OPTIONS } from '@/constants/driveSchemas'
import DynamicConfigForm from './DynamicConfigForm.vue'
import CorsConfig from './CorsConfig.vue'
import AclConfig from './AclConfig.vue'

const props = defineProps<{
  show: boolean
  config?: DriveConfig | null
  isEdit: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'saved'): void
}>()

const { t } = useI18n()
const configStore = useConfigStore()
const message = useMessage()
const formRef = ref()

const defaultForm: any = {

  id: '',
  name: '',
  type: '', // Default empty, user needs to select
  enabled: true,
  // Dynamic fields will be populated by v-model binding
}

const formModel = ref({ ...defaultForm })
const currentStep = ref(0) // 0: Select Type, 1: Config Form

// Drive Categories Definition
const DRIVE_CATEGORIES = [
  {
    id: 'self-hosted',
    title: 'config.categories.selfHosted',
    types: ['lsky', 'easyimages', 'chevereto', 'imgurl', 'zpic', 'hellohao']
  },
  {
    id: 'cloud',
    title: 'config.categories.cloud',
    types: ['aliyun', 'tencent', 'aws']
  },
  {
    id: 'public',
    title: 'config.categories.public',
    types: ['smms', 'imgur', 'github']
  },
  {
    id: 'custom',
    title: 'config.categories.custom',
    types: ['custom']
  }
]

// Get current schema based on selected type
const currentSchema = computed(() => {
    return DRIVE_SCHEMAS[formModel.value.type] || []
})

// Generate rules dynamically based on schema
const rules = computed(() => {
    const baseRules: any = {
        name: { required: true, message: () => t('config.validation.required'), trigger: 'blur' },
        type: { required: true, message: () => t('config.validation.required'), trigger: 'blur' },
    }
    
    // Add required rules from schema
    currentSchema.value.forEach(field => {
        if (field.required) {
            baseRules[field.key] = {
                required: true,
                message: () => t('config.validation.required'),
                trigger: 'blur'
            }
        }
    })
    
    return baseRules
})

watch(() => props.show, (newVal) => {
    if (newVal) {
        if (props.isEdit && props.config) {
            formModel.value = { ...defaultForm, ...props.config }
            currentStep.value = 1
        } else {
            formModel.value = { ...defaultForm }
            currentStep.value = 0
        }
    }
})

watch(() => formModel.value.type, (newType) => {
    if (newType && !props.isEdit && props.show) {
        applyDefaults()
    }
})

function applyDefaults() {
    const schema = DRIVE_SCHEMAS[formModel.value.type]
    if (!schema) return
    
    schema.forEach(field => {
        if (field.defaultValue !== undefined) {
            formModel.value[field.key] = field.defaultValue
        }
    })
}

function handleSelectType(type: string) {
    formModel.value.type = type
    currentStep.value = 1
}

function handleBack() {
    currentStep.value = 0
}

function handleSaveConfig() {
  formRef.value?.validate((errors: any) => {
    if (!errors) {
      const config = { ...formModel.value }
      if (props.isEdit) {
        configStore.updateConfig(config.id, config as DriveConfig)
        message.success(t('common.success'))
      } else {
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

function handleClose() {
    emit('update:show', false)
}

function getDriveLabel(value: string) {
    const option = DRIVE_TYPE_OPTIONS.find(opt => opt.value === value)
    return option ? option.label : value
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
        <!-- Step 0: Select Type -->
        <DriveSelector 
            v-if="currentStep === 0"
            v-model="formModel.type"
            @select="handleSelectType"
        />

        <!-- Step 1: Config Form -->
        <div v-else class="p-6">
            <n-form ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="medium">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <n-form-item :label="t('config.form.name')" path="name">
                        <n-input v-model:value="formModel.name" :placeholder="t('config.form.namePlaceholder')" />
                    </n-form-item>
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
                    <!-- Dynamic Form -->
                    <DynamicConfigForm 
                        :schema="currentSchema"
                        v-model="formModel"
                    />
                </div>

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

      <template #footer>
        <div class="flex justify-between items-center w-full">
            <div v-if="currentStep === 1 && !isEdit">
                 <button @click="handleBack" 
                    class="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    <div class="i-ph-arrow-left" />
                    {{ t('common.back') }}
                </button>
            </div>
            <div v-else></div> <!-- Spacer -->

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
