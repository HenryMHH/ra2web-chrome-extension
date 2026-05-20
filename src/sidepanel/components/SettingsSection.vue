<script setup lang="ts">
import DisplayUnitNamesRow from './DisplayUnitNamesRow.vue'
import FontSizeSlider from './FontSizeSlider.vue'
import IndicatorsRow from './IndicatorsRow.vue'
import type { Ra2Settings } from '~/popup/composables/useRa2Settings'

// SettingsSection is a presentational composer for the settings group; it deliberately
// mutates nested fields on the `settings` reactive prop (passed through from the
// `Sidepanel` Ref<Ra2Settings>) so consumers can simply wire `:settings="settings"`
// without enumerating each v-model. Vue's ref auto-unwrapping keeps reactivity intact.
/* eslint-disable vue/no-mutating-props */
defineProps<{ settings: Ra2Settings }>()
defineEmits<{ change: [] }>()
</script>

<template>
  <section class="p-4 space-y-4">
    <h2 class="text-sm font-semibold text-foreground uppercase tracking-wider">
      設定
    </h2>
    <DisplayUnitNamesRow
      :model-value="settings.enabled"
      :ally="settings.showAlly"
      :enemy="settings.showEnemy"
      :neutral="settings.showNeutral"
      @update:model-value="(v) => { settings.enabled = v; $emit('change') }"
      @update:ally="(v) => { settings.showAlly = v; $emit('change') }"
      @update:enemy="(v) => { settings.showEnemy = v; $emit('change') }"
      @update:neutral="(v) => { settings.showNeutral = v; $emit('change') }"
    />
    <IndicatorsRow
      :model-value="settings.showIndicators"
      @update:model-value="(v) => { settings.showIndicators = v; $emit('change') }"
    />
    <FontSizeSlider
      :model-value="settings.fontSize"
      :disabled="!settings.enabled"
      @update:model-value="(v) => { settings.fontSize = v; $emit('change') }"
    />
  </section>
</template>
