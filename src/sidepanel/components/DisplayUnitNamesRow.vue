<script setup lang="ts">
import AppCheckbox from '~/components/ui/AppCheckbox.vue'
import AppSwitch from '~/components/ui/AppSwitch.vue'

defineProps<{
  modelValue: boolean
  ally: boolean
  enemy: boolean
  neutral: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'update:ally': [v: boolean]
  'update:enemy': [v: boolean]
  'update:neutral': [v: boolean]
}>()

function emitFaction(f: 'ally' | 'enemy' | 'neutral', v: boolean) {
  if (f === 'ally')
    emit('update:ally', v)
  else if (f === 'enemy')
    emit('update:enemy', v)
  else
    emit('update:neutral', v)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-foreground">
          顯示單位名稱
        </p>
        <p class="text-xs text-muted-foreground">
          在每個單位上方顯示陣營色名稱
        </p>
      </div>
      <AppSwitch data-testid="display-toggle" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
    </div>
    <div class="flex gap-2 pl-1">
      <label
        v-for="f in (['ally', 'enemy', 'neutral'] as const)"
        :key="f"
        :data-testid="`faction-${f}`"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 cursor-pointer transition-colors"
        :class="!modelValue ? 'opacity-50 pointer-events-none' : ''"
      >
        <AppCheckbox
          :model-value="$props[f]"
          :disabled="!modelValue"
          @update:model-value="emitFaction(f, $event)"
        />
        <span class="text-sm text-secondary-foreground">
          {{ f === 'ally' ? 'Ally' : f === 'enemy' ? 'Enemy' : 'Neutral' }}
        </span>
      </label>
    </div>
  </div>
</template>
