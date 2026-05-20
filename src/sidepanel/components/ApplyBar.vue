<script setup lang="ts">
withDefaults(defineProps<{
  hint?: string
  label?: string
  disabled?: boolean
}>(), {
  label: '套用變更',
  disabled: false,
})
defineEmits<{ apply: [] }>()
</script>

<template>
  <div class="p-4 border-t border-border bg-card">
    <button
      type="button"
      class="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
      :disabled="disabled"
      @click="$emit('apply')"
    >
      {{ label }}
    </button>
    <p v-if="hint" class="text-center text-xs text-muted-foreground mt-2">
      {{ hint }}
    </p>
  </div>
</template>
