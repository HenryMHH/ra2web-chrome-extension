<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <label class="row">
    <input
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
    <span>顯示畫面外敵人指標</span>
  </label>
</template>

<style scoped>
.row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
</style>
