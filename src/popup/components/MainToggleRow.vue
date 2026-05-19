<script setup lang="ts">
defineProps<{ modelValue: boolean, neutral: boolean }>()
defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:neutral', v: boolean): void
}>()
</script>

<template>
  <section>
    <label class="row">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      >
      <span>顯示單位名稱</span>
    </label>
    <label class="row" :class="{ disabled: !modelValue }">
      <input
        type="checkbox"
        :disabled="!modelValue"
        :checked="neutral"
        @change="$emit('update:neutral', ($event.target as HTMLInputElement).checked)"
      >
      <span>顯示中立單位</span>
    </label>
  </section>
</template>

<style scoped>
.row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
.row.disabled { opacity: 0.5; pointer-events: none; }
</style>
