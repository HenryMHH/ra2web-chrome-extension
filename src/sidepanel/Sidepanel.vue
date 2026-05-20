<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import MainToggleRow from '~/popup/components/MainToggleRow.vue'
import FontSizeRow from '~/popup/components/FontSizeRow.vue'
import IndicatorsRow from '~/popup/components/IndicatorsRow.vue'
import CrateGrid from '~/popup/components/CrateGrid.vue'
import UnitFilter from '~/popup/components/UnitFilter.vue'
import StatusBar from '~/popup/components/StatusBar.vue'
import { useRa2Settings } from '~/popup/composables/useRa2Settings'
import { useRa2Snapshots } from '~/popup/composables/useRa2Snapshots'
import { useRa2Bridge } from '~/popup/composables/useRa2Bridge'

const { settings, ready, load, save } = useRa2Settings()
const { snapshots, load: loadSnapshots } = useRa2Snapshots()
const bridge = useRa2Bridge()
const status = ref<{ kind: 'idle' | 'ok' | 'active' | 'error', text: string }>({
  kind: 'idle',
  text: '尚未連線',
})

async function init() {
  await Promise.all([load(), loadSnapshots()])
  if (settings.value.selectedPresetIndex >= snapshots.value.length)
    settings.value.selectedPresetIndex = -1
}
init()

const effectiveShownUnits = computed<'all' | string[]>(() => {
  if (settings.value.filterMode === 'preset'
    && settings.value.selectedPresetIndex >= 0
    && snapshots.value[settings.value.selectedPresetIndex]) {
    return snapshots.value[settings.value.selectedPresetIndex].shownUnits
  }
  return settings.value.shownUnitsCustom
})

async function refreshStatus() {
  const s = await bridge.status()
  if (!s || (s as any).injected === false) {
    status.value = { kind: 'error', text: '尚未連線（請打開 ra2web 分頁）' }
    return
  }
  status.value = (s as any).enabled
    ? { kind: 'active', text: '已啟用' }
    : { kind: 'ok', text: '已連線' }
}

watchEffect(() => {
  if (ready.value)
    refreshStatus()
})

// Sidepanel 是長駐 UI，需在 active tab 切換時重抓 status，
// 否則使用者切到非 ra2 tab 後狀態列會停在舊資料。
function onTabActivated() {
  refreshStatus()
}
onMounted(() => {
  browser.tabs.onActivated.addListener(onTabActivated)
})
onBeforeUnmount(() => {
  browser.tabs.onActivated.removeListener(onTabActivated)
})

async function apply() {
  await save()
  const r = await bridge.apply({
    enabled: settings.value.enabled,
    showNeutral: settings.value.showNeutral,
    showIndicators: settings.value.showIndicators,
    enabledCrateTypes: settings.value.enabledCrateTypes,
    fontSize: settings.value.fontSize,
    shownUnits: effectiveShownUnits.value,
  })
  if (r.ok) {
    const active = settings.value.enabled || settings.value.showIndicators || settings.value.enabledCrateTypes.length > 0
    status.value = active
      ? { kind: 'active', text: '已套用 — 啟用中' }
      : { kind: 'ok', text: '已套用 — 未啟用' }
  }
  else {
    status.value = { kind: 'error', text: `失敗：${r.error ?? 'unknown'}` }
  }
}
</script>

<template>
  <main class="sidepanel">
    <StatusBar :kind="status.kind" :text="status.text" />

    <MainToggleRow
      v-model="settings.enabled"
      v-model:neutral="settings.showNeutral"
    />
    <FontSizeRow v-model="settings.fontSize" :disabled="!settings.enabled" />
    <IndicatorsRow v-model="settings.showIndicators" />
    <CrateGrid v-model="settings.enabledCrateTypes" />
    <UnitFilter
      v-model:shownUnitsCustom="settings.shownUnitsCustom"
      v-model:filterMode="settings.filterMode"
      v-model:selectedPresetIndex="settings.selectedPresetIndex"
    />

    <button class="apply" type="button" @click="apply">
      套用
    </button>
  </main>
</template>

<style scoped>
.sidepanel { padding: 12px; font-family: system-ui, -apple-system, sans-serif; }
.apply { width: 100%; padding: 8px; margin-top: 12px; }
</style>
