<script setup lang="ts">
import DisplayUnitNamesRow from './DisplayUnitNamesRow.vue'
import FontSizeSlider from './FontSizeSlider.vue'
import IndicatorsRow from './IndicatorsRow.vue'

defineProps<{
  enabled: boolean
  showAlly: boolean
  showEnemy: boolean
  showNeutral: boolean
  showIndicators: boolean
  fontSize: number
}>()
defineEmits<{
  'update:enabled': [v: boolean]
  'update:showAlly': [v: boolean]
  'update:showEnemy': [v: boolean]
  'update:showNeutral': [v: boolean]
  'update:showIndicators': [v: boolean]
  'update:fontSize': [v: number]
}>()
</script>

<template>
  <section class="p-4 space-y-4">
    <h2 class="text-sm font-semibold text-foreground uppercase tracking-wider">
      設定
    </h2>
    <DisplayUnitNamesRow
      :model-value="enabled"
      :ally="showAlly"
      :enemy="showEnemy"
      :neutral="showNeutral"
      @update:model-value="$emit('update:enabled', $event)"
      @update:ally="$emit('update:showAlly', $event)"
      @update:enemy="$emit('update:showEnemy', $event)"
      @update:neutral="$emit('update:showNeutral', $event)"
    />
    <IndicatorsRow
      :model-value="showIndicators"
      @update:model-value="$emit('update:showIndicators', $event)"
    />
    <FontSizeSlider
      :model-value="fontSize"
      :disabled="!enabled"
      @update:model-value="$emit('update:fontSize', $event)"
    />
  </section>
</template>
