<script setup lang="ts">
defineProps<{ kind: 'idle' | 'ok' | 'active' | 'error', text: string }>()
</script>

<template>
  <div class="bar" :class="`bar-${kind}`">
    {{ text }}
  </div>
</template>

<style scoped>
.bar { padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 6px; }
.bar-idle { background: #eee; color: #444; }
.bar-ok { background: #cde; color: #036; }
.bar-active { background: #cdf3d6; color: #064; }
.bar-error { background: #fdd; color: #800; }
</style>
