<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import MainToggleRow from '~/popup/components/MainToggleRow.vue'
import FontSizeRow from '~/popup/components/FontSizeRow.vue'
import IndicatorsRow from '~/popup/components/IndicatorsRow.vue'
import CrateGrid from '~/popup/components/CrateGrid.vue'
import UnitFilter from '~/popup/components/UnitFilter.vue'
import StatusBar from '~/popup/components/StatusBar.vue'
import ActiveFilterInfo from '~/popup/components/ActiveFilterInfo.vue'
import type { AppliedFilter } from '~/popup/components/ActiveFilterInfo.vue'
import Toast from '~/popup/components/Toast.vue'
import { useRa2Settings } from '~/popup/composables/useRa2Settings'
import { useRa2Snapshots } from '~/popup/composables/useRa2Snapshots'
import { useRa2Bridge } from '~/popup/composables/useRa2Bridge'
import { useToast } from '~/popup/composables/useToast'

const { settings, ready, load, save } = useRa2Settings()
const { snapshots, load: loadSnapshots } = useRa2Snapshots()
const bridge = useRa2Bridge()
const toast = useToast()
const status = ref<{ kind: 'idle' | 'ok' | 'active' | 'error', text: string }>({
  kind: 'idle',
  text: '尚未連線',
})
const totalCount = ref(0)
const lastApplied = ref<AppliedFilter | null>(null)

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
    const snap = settings.value.filterMode === 'preset' && settings.value.selectedPresetIndex >= 0
      ? snapshots.value[settings.value.selectedPresetIndex]
      : undefined
    lastApplied.value = {
      mode: settings.value.filterMode,
      shownUnits: effectiveShownUnits.value,
      total: snap ? snap.totalCount : totalCount.value,
      snapshotName: snap?.name,
    }
    toast.show('ok', settings.value.enabled ? '已套用' : '已停用')
  }
  else {
    status.value = { kind: 'error', text: `失敗：${r.error ?? 'unknown'}` }
    toast.show('err', `套用失敗：${r.error ?? 'unknown'}`)
  }
}
</script>

<template>
  <main class="sidepanel">
    <StatusBar :kind="status.kind" :text="status.text" />
    <ActiveFilterInfo :applied="lastApplied" />
    <Toast />

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
      v-model:totalCount="totalCount"
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
