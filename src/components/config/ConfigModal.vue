<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useConfigStore } from '@/stores/config'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { useThemeStore } from '@/stores/theme'
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
const themeStore = useThemeStore()

const primaryColor = computed(() => themeStore.themeOverrides?.common?.primaryColor || '#ef4444')

const defaultForm: any = {
  id: '',
  name: '',
  type: 'lsky',
  enabled: true,
  // Dynamic fields will be populated by v-model binding
}

const formModel = ref({ ...defaultForm })

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
        } else {
            formModel.value = { ...defaultForm }
            applyDefaults()
        }
    }
})

watch(() => formModel.value.type, () => {
    if (!props.isEdit && props.show) {
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
</script>

<template>
    <n-modal 
        :show="show" 
        @update:show="(val: boolean) => emit('update:show', val)"
        preset="card" 
        :title="isEdit ? t('config.editTitle') : t('config.addTitle')" 
        class="w-full max-w-2xl rounded-[24px] overflow-hidden shadow-xl" 
        :segmented="true"
        :header-style="{ padding: '20px 24px', borderBottom: '1px solid var(--n-border-color)' }"
        :content-style="{ padding: '24px' }"
        :footer-style="{ padding: '16px 24px', borderTop: '1px solid var(--n-border-color)' }"
    >
      <n-form ref="formRef" :model="formModel" :rules="rules" label-placement="top" size="medium">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <n-form-item :label="t('config.form.name')" path="name">
              <n-input v-model:value="formModel.name" :placeholder="t('config.form.namePlaceholder')" />
            </n-form-item>
            <n-form-item :label="t('config.form.type')" path="type">
              <n-select v-model:value="formModel.type" :options="DRIVE_TYPE_OPTIONS" :disabled="isEdit" />
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
      <template #footer>
        <div class="flex justify-end gap-3">
          <button @click="handleClose" 
            class="giopic-link-btn px-4 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
            {{ t('common.cancel') }}
          </button>
          <button @click="handleSaveConfig" 
            class="giopic-link-btn px-6 h-9 rounded-lg text-white hover:opacity-90 font-medium transition-opacity shadow-sm"
            :style="{ backgroundColor: primaryColor }">
            {{ t('common.save') }}
          </button>
        </div>
      </template>
    </n-modal>
</template>
