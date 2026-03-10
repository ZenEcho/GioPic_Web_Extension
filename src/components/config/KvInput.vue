<!--
 * Component Name: KvInput
 * Author: GioPic Team
 * Description: 键值对输入组件，用于配置 HTTP Headers 或自定义参数。
 * 
 * Functional Domain:
 * Config (配置模块) - 辅助输入组件
 * 
 * Key Features:
 * - 键值对管理：支持添加、删除、编辑 Key-Value 对
 * - JSON 序列化：内部以 JSON 字符串格式与父组件通信
 * - 格式兼容：自动处理数组格式和旧的对象格式
 * 
 * Props:
 * - value (string): JSON 字符串格式的键值对数据
 * - disabled (boolean): 是否禁用输入
 * 
 * Events:
 * - update:value: 更新键值对数据
 -->

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  value: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const list = ref<{ key: string, value: string }[]>([])

watch(() => props.value, (newValue) => {
  let parsed: { key: string, value: string }[] = []
  try {
    const raw = JSON.parse(newValue || '[]')
    if (Array.isArray(raw)) {
      parsed = raw
    } else {
      parsed = Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }))
    }
  } catch (e) {
    parsed = []
  }

  if (JSON.stringify(parsed) !== JSON.stringify(list.value)) {
    list.value = parsed
  }
}, { immediate: true })

function handleUpdate(val: { key: string, value: string }[]) {
  list.value = val
  emit('update:value', JSON.stringify(val))
}
</script>

<template>
  <n-dynamic-input
    :value="list"
    @update:value="handleUpdate as any"
    preset="pair"
    key-placeholder="Key"
    value-placeholder="Value"
    class="w-full"
    :disabled="disabled"
  />
</template>
