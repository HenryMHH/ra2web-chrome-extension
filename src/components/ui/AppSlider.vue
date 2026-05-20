<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>()
defineEmits<{ 'update:modelValue': [v: number] }>()
</script>

<template>
  <SliderRoot
    :model-value="[modelValue]"
    :min="min ?? 0"
    :max="max ?? 100"
    :step="step ?? 1"
    :disabled="disabled"
    class="relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50"
    @update:model-value="$emit('update:modelValue', ($event as number[])[0])"
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-muted-foreground/20">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb class="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm transition-[box-shadow] hover:ring-4 hover:ring-primary/20 focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:outline-none" />
  </SliderRoot>
</template>
