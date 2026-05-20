<script setup lang="ts">
import { computed } from 'vue'
import type { ShownUnits } from '~/popup/composables/useRa2Settings'

export interface AppliedFilter {
  mode: 'custom' | 'preset'
  shownUnits: ShownUnits
  total: number
  snapshotName?: string
}

const props = defineProps<{
  applied: AppliedFilter | null
}>()

const text = computed(() => {
  const a = props.applied
  if (!a)
    return '尚未套用'
  if (a.mode === 'preset') {
    const shownCount = a.shownUnits === 'all' ? '全部' : String(a.shownUnits.length)
    return `套用中：快照 — ${a.snapshotName ?? ''}（${shownCount} / ${a.total}）`
  }
  if (a.shownUnits === 'all')
    return '套用中：單場自訂 — 全部顯示'
  if (a.shownUnits.length === 0)
    return '套用中：單場自訂 — 全部隱藏'
  return `套用中：單場自訂 — 顯示 ${a.shownUnits.length} 個`
})

const kind = computed(() => {
  const a = props.applied
  if (!a)
    return 'idle'
  if (a.mode === 'preset')
    return 'preset'
  if (a.shownUnits === 'all')
    return 'custom'
  return 'custom has-hidden'
})
</script>

<template>
  <p class="active-filter-info" :class="[kind]">
    {{ text }}
  </p>
</template>

<style scoped>
.active-filter-info {
  font-size: 11px;
  color: #777;
  margin: 4px 0;
  padding: 2px 4px;
}
.active-filter-info.idle { color: #999; font-style: italic; }
.active-filter-info.preset { color: #6b3dab; }
.active-filter-info.custom { color: #777; }
.active-filter-info.custom.has-hidden { color: #a06800; }
</style>
