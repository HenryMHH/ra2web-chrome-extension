<script setup lang="ts">
import AppSwitch from '~/components/ui/AppSwitch.vue'

defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<template>
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm font-medium text-foreground">
        畫面外敵人指標
      </p>
      <p class="text-xs text-muted-foreground">
        在 viewport 邊緣顯示紅色箭頭
      </p>
    </div>
    <AppSwitch :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" />
  </div>
</template>
