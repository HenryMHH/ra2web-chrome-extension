<script setup lang="ts">
import { useToast } from '~/popup/composables/useToast'

const { msg } = useToast()
</script>

<template>
  <Transition name="toast">
    <div v-if="msg" class="toast" :class="[msg.kind]" role="status" aria-live="polite">
      {{ msg.text }}
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  font-size: 12px;
  padding: 4px 8px;
  margin: 4px 0;
  border-radius: 3px;
  background: #f4f4f4;
  border: 1px solid #ddd;
  color: #444;
}
.toast.ok { color: #1a7e1a; border-color: #b6e2b6; background: #f4fbf4; }
.toast.warn { color: #a06800; border-color: #f0d68a; background: #fdf8e9; }
.toast.err { color: #b00; border-color: #f0a8a8; background: #fdf0f0; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.15s; }
.toast-enter-from, .toast-leave-to { opacity: 0; }
</style>
