<script setup lang="ts">
import { computed } from 'vue'
import { CRATE_TYPES } from '~/constants/powerups'

const props = defineProps<{ modelValue: number[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number[]): void }>()

const selected = computed(() => new Set(props.modelValue))

function toggle(id: number) {
  const next = new Set(selected.value)
  if (next.has(id))
    next.delete(id)
  else next.add(id)
  emit('update:modelValue', [...next])
}
function selectAll() {
  emit('update:modelValue', CRATE_TYPES.map(t => t.id))
}
function selectNone() {
  emit('update:modelValue', [])
}
</script>

<template>
  <details open>
    <summary>寶箱內容</summary>
    <div class="grid">
      <label v-for="t in CRATE_TYPES" :key="t.id" class="cell">
        <input
          type="checkbox"
          :checked="selected.has(t.id)"
          @change="toggle(t.id)"
        >
        <span>{{ t.label }}</span>
      </label>
    </div>
    <div class="actions">
      <button type="button" @click="selectAll">
        全選
      </button>
      <button type="button" @click="selectNone">
        全不選
      </button>
    </div>
  </details>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.cell { display: flex; gap: 4px; align-items: center; font-size: 12px; }
.actions { display: flex; gap: 6px; margin-top: 6px; }
</style>
