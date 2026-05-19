<script setup lang="ts">
defineProps<{ modelValue: number, disabled?: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: number): void }>()
const SIZES = [10, 12, 14, 16, 18, 20]
</script>

<template>
  <label class="row" :class="{ disabled }">
    <span>字體大小</span>
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="n in SIZES" :key="n" :value="n">{{ n }} px</option>
    </select>
  </label>
</template>

<style scoped>
.row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
.row.disabled { opacity: 0.5; pointer-events: none; }
</style>
