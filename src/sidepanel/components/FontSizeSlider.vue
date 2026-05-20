<script setup lang="ts">
import AppSlider from '~/components/ui/AppSlider.vue'

defineProps<{ modelValue: number, disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [v: number] }>()
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-foreground">
        字體大小
      </p>
      <span class="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{{ modelValue }}px</span>
    </div>
    <AppSlider
      :model-value="modelValue"
      :min="10"
      :max="20"
      :step="1"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>
