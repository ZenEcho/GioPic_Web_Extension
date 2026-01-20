<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  value: string
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
      // Fallback for old object format
      parsed = Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }))
    }
  } catch (e) {
    parsed = []
  }

  // Only update if the content is actually different to prevent focus loss
  // This comparison works because the structure is simple
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
  />
</template>
