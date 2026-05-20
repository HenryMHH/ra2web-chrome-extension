<script setup lang="ts">
import { ref } from 'vue'
import AppCollapsible from '~/components/ui/AppCollapsible.vue'
import { CRATE_TYPES } from '~/constants/powerups'

const props = defineProps<{ modelValue: number[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: number[]] }>()

const open = ref(true)

function toggle(id: number) {
  const set = new Set(props.modelValue)
  if (set.has(id))
    set.delete(id)
  else set.add(id)
  emit('update:modelValue', [...set])
}
function selectAll() {
  emit('update:modelValue', CRATE_TYPES.map(t => t.id))
}
function deselectAll() {
  emit('update:modelValue', [])
}
function isOn(id: number) {
  return props.modelValue.includes(id)
}
</script>

<template>
  <div class="border-t border-border">
    <AppCollapsible v-model:open="open" title="寶箱內容顯示">
      <div class="space-y-3">
        <div class="flex gap-2">
          <button
            type="button"
            class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            @click="selectAll"
          >
            全選
          </button>
          <button
            type="button"
            class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            @click="deselectAll"
          >
            全不選
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in CRATE_TYPES"
            :key="t.id"
            type="button"
            class="text-xs px-3 py-1.5 rounded-lg border transition-all"
            :class="isOn(t.id)
              ? 'bg-primary/15 border-primary/50 text-primary hover:bg-primary/25'
              : 'bg-secondary border-transparent text-muted-foreground hover:bg-secondary/80 hover:text-secondary-foreground'"
            @click="toggle(t.id)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </AppCollapsible>
  </div>
</template>
