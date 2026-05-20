<script setup lang="ts">
import CheckAnimation from './CheckAnimation.vue'

withDefaults(defineProps<{
  label?: string
  disabled?: boolean
  success?: boolean
}>(), {
  label: '套用變更',
  disabled: false,
  success: false,
})
defineEmits<{ apply: [] }>()
</script>

<template>
  <div class="p-4 border-t border-border bg-card">
    <button
      type="button"
      class="w-full h-12 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:bg-primary flex items-center justify-center"
      :class="{ 'opacity-50': disabled && !success }"
      :disabled="disabled || success"
      @click="$emit('apply')"
    >
      <CheckAnimation v-if="success" />
      <span v-else>{{ label }}</span>
    </button>
  </div>
</template>
