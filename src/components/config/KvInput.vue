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
 * 
 * Events:
 * - update:value: 更新键值对数据
 -->

<script setup lang="ts">
import { ref, watch } from 'vue'

// 定义组件 Props
const props = defineProps<{
  value: string
}>()

// 定义组件 Events
const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

// 内部列表状态
const list = ref<{ key: string, value: string }[]>([])

// 监听外部值变化，解析为内部列表格式
watch(() => props.value, (newValue) => {
  let parsed: { key: string, value: string }[] = []
  try {
    const raw = JSON.parse(newValue || '[]')
    if (Array.isArray(raw)) {
      // 标准数组格式
      parsed = raw
    } else {
      // 兼容旧的对象格式 {key: value}
      parsed = Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }))
    }
  } catch (e) {
    // 解析失败时重置为空数组
    parsed = []
  }

  // 仅在内容实际发生变化时更新，避免输入焦点丢失
  if (JSON.stringify(parsed) !== JSON.stringify(list.value)) {
    list.value = parsed
  }
}, { immediate: true })

// 处理输入变化，序列化为 JSON 并触发更新
function handleUpdate(val: { key: string, value: string }[]) {
  list.value = val
  emit('update:value', JSON.stringify(val))
}
</script>

<template>
  <!-- 使用 Naive UI 的动态输入组件，预设为键值对模式 -->
  <n-dynamic-input
    :value="list"
    @update:value="handleUpdate as any"
    preset="pair"
    key-placeholder="Key"
    value-placeholder="Value"
    class="w-full"
  />
</template>
