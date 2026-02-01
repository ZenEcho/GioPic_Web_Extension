<!--
 * Component Name: AclConfig
 * Author: GioPic Team
 * Description: 访问控制列表 (ACL) 配置组件，用于设置云存储 Bucket 的访问权限。
 * 
 * Functional Domain:
 * Config (配置模块) - 高级配置子组件
 * 
 * Key Features:
 * - 权限管理：查看和设置 Bucket 的 ACL (如 public-read, private 等)
 * - 多云支持：适配 Aliyun OSS, Tencent COS, AWS S3
 * - 实时操作：直接调用云厂商 API 进行配置
 * 
 * Props:
 * - config (DriveConfig): 驱动配置对象
 * - type (string): 驱动类型 ('aliyun' | 'tencent' | 'aws')
 -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { AliyunConfig, TencentConfig, S3Config } from '@/types'
import { 
    getAliyunAcl, setAliyunAcl, 
    getTencentAcl, setTencentAcl,
    getS3Acl, setS3Acl,
    type AclType
} from '@/services/bucket'

// 定义组件 Props
const props = defineProps<{
    config: AliyunConfig | TencentConfig | S3Config
    type: 'aliyun' | 'tencent' | 'aws'
}>()

const { t } = useI18n()
const message = useMessage()
const loading = ref(false)
const acl = ref<string>('default')

// ACL 选项定义
const aclOptions = computed(() => {
    const opts = [
        { label: t('config.acl.options.default'), value: 'default' }, // 默认
        { label: t('config.acl.options.private'), value: 'private' }, // 私有
        { label: t('config.acl.options.publicRead'), value: 'public-read' }, // 公共读
        { label: t('config.acl.options.publicReadWrite'), value: 'public-read-write' }, // 公共读写
    ]

    // AWS S3 支持额外的 'authenticated-read' 选项
    if (props.type === 'aws') {
        opts.push({ label: t('config.acl.options.authenticatedRead'), value: 'authenticated-read' })
    }
    
    return opts
})

// 获取驱动类型显示名称
const typeName = computed(() => t(`providers.${props.type}`))

// 从云端获取当前 ACL 设置
async function handleGetAcl() {
    loading.value = true
    try {
        let result = 'default'
        if (props.type === 'aliyun') {
            result = await getAliyunAcl(props.config as AliyunConfig)
        } else if (props.type === 'tencent') {
            result = await getTencentAcl(props.config as TencentConfig)
        } else if (props.type === 'aws') {
            result = await getS3Acl(props.config as S3Config)
        }
        
        acl.value = result
        message.success(t('common.success'))
    } catch (e: any) {
        console.error(e)
        message.error(e.message || t('config.acl.getFailed'))
    } finally {
        loading.value = false
    }
}

// 将 ACL 设置应用到云端
async function handleSetAcl() {
    loading.value = true
    try {
        if (props.type === 'aliyun') {
            await setAliyunAcl(props.config as AliyunConfig, acl.value)
        } else if (props.type === 'tencent') {
            await setTencentAcl(props.config as TencentConfig, acl.value)
        } else if (props.type === 'aws') {
            await setS3Acl(props.config as S3Config, acl.value)
        }
        message.success(t('common.success'))
    } catch (e: any) {
        console.error(e)
        message.error(e.message || t('config.acl.setFailed'))
    } finally {
        loading.value = false
    }
}

</script>

<template>
    <div class="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50">
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            {{ t('config.acl.title', { type: typeName }) }}
            <n-tooltip trigger="hover">
                <template #trigger>
                    <div class="i-ph-question text-gray-400 cursor-pointer text-xs"></div>
                </template>
                {{ t('config.acl.desc') }}
            </n-tooltip>
        </h3>
        
        <!-- ACL 选项下拉框 -->
        <n-form-item :label="t('config.acl.permission')" label-placement="top" :show-feedback="false">
             <n-select v-model:value="acl" :options="aclOptions" />
        </n-form-item>

        <!-- 操作按钮区域 -->
        <div class="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-200 dark:border-gray-700/50">
             <!-- 获取按钮 -->
             <button @click="handleGetAcl" :disabled="loading"
                class="giopic-link-btn px-3 h-8 text-xs font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1">
                <div class="i-ph-cloud-arrow-down" />
                {{ t('config.acl.get') }}
            </button>
            <!-- 设置按钮 -->
            <button @click="handleSetAcl" :disabled="loading"
                class="giopic-link-btn px-3 h-8 text-xs font-bold rounded bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors flex items-center gap-1">
                <div class="i-ph-cloud-arrow-up" />
                {{ t('config.acl.set') }}
            </button>
        </div>
    </div>
</template>
