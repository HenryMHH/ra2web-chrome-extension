<script setup lang="ts">
defineProps<{ hint?: string }>()
defineEmits<{ apply: [] }>()
</script>

<template>
  <div class="p-4 border-t border-border bg-card">
    <button
      type="button"
      class="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all active:scale-[0.98]"
      @click="$emit('apply')"
    >
      套用變更
    </button>
    <p v-if="hint" class="text-center text-xs text-muted-foreground mt-2">
      {{ hint }}
    </p>
  </div>
</template>
