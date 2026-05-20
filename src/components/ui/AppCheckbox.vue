<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

defineProps<{ modelValue: boolean, disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<template>
  <CheckboxRoot
    :model-value="modelValue"
    :disabled="disabled"
    class="peer size-4 shrink-0 rounded-[4px] border border-input bg-card shadow-xs outline-none transition-shadow disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
    @update:model-value="$emit('update:modelValue', $event === true)"
  >
    <CheckboxIndicator class="flex items-center justify-center text-primary-foreground">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
