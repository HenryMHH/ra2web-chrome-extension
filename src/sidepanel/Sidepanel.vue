<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { RA2_GAME_VERSION as VERSION } from '~/constants/gameVersion'
import AppHeader from '~/sidepanel/components/AppHeader.vue'
import ApplyBar from '~/sidepanel/components/ApplyBar.vue'
import SettingsSection from '~/sidepanel/components/SettingsSection.vue'
import CrateSection from '~/sidepanel/components/CrateSection.vue'
import FilterSection from '~/sidepanel/components/FilterSection.vue'
import StatusBar from '~/sidepanel/components/StatusBar.vue'
import ActiveFilterInfo from '~/sidepanel/components/ActiveFilterInfo.vue'
import type { AppliedFilter } from '~/sidepanel/components/ActiveFilterInfo.vue'
import Toast from '~/sidepanel/components/Toast.vue'
import type { ShownUnits } from '~/composables/useRa2Settings'
import { useRa2Settings } from '~/composables/useRa2Settings'
import { useRa2Snapshots } from '~/composables/useRa2Snapshots'
import { useRa2Bridge } from '~/composables/useRa2Bridge'
import { useToast } from '~/composables/useToast'

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
const applySuccess = ref(false)
const APPLY_SUCCESS_MS = 1600

const draftFilter = ref<{
  shownUnitsCustom: ShownUnits
  filterMode: 'custom' | 'preset'
  selectedPresetIndex: number
}>({
  shownUnitsCustom: 'all',
  filterMode: 'custom',
  selectedPresetIndex: -1,
})

function syncDraftFromSettings() {
  draftFilter.value = {
    shownUnitsCustom: Array.isArray(settings.value.shownUnitsCustom)
      ? [...settings.value.shownUnitsCustom]
      : settings.value.shownUnitsCustom,
    filterMode: settings.value.filterMode,
    selectedPresetIndex: settings.value.selectedPresetIndex,
  }
}

let suppressInstant = true

async function init() {
  await Promise.all([load(), loadSnapshots()])
  if (settings.value.selectedPresetIndex >= snapshots.value.length)
    settings.value.selectedPresetIndex = -1
  syncDraftFromSettings()
  await nextTick()
  suppressInstant = false
}
init()

const appliedShownUnits = computed<ShownUnits>(() => {
  if (
    settings.value.filterMode === 'preset'
    && settings.value.selectedPresetIndex >= 0
    && snapshots.value[settings.value.selectedPresetIndex]
  ) {
    return snapshots.value[settings.value.selectedPresetIndex].shownUnits
  }
  return settings.value.shownUnitsCustom
})

function shownUnitsEqual(a: ShownUnits, b: ShownUnits): boolean {
  if (a === 'all' || b === 'all')
    return a === b
  if (a.length !== b.length)
    return false
  const set = new Set(a)
  return b.every(x => set.has(x))
}

const filterDirty = computed(() =>
  draftFilter.value.filterMode !== settings.value.filterMode
  || draftFilter.value.selectedPresetIndex !== settings.value.selectedPresetIndex
  || !shownUnitsEqual(draftFilter.value.shownUnitsCustom, settings.value.shownUnitsCustom),
)

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

async function sendApply(opts: { source: 'instant' | 'filter' }) {
  await save()
  const r = await bridge.apply({
    enabled: settings.value.enabled,
    showNeutral: settings.value.showNeutral,
    showAlly: settings.value.showAlly,
    showEnemy: settings.value.showEnemy,
    showIndicators: settings.value.showIndicators,
    enabledCrateTypes: settings.value.enabledCrateTypes,
    fontSize: settings.value.fontSize,
    shownUnits: appliedShownUnits.value,
  })
  if (r.ok) {
    const active
      = settings.value.enabled
      || settings.value.showIndicators
      || settings.value.enabledCrateTypes.length > 0
    status.value = active
      ? { kind: 'active', text: '已套用 — 啟用中' }
      : { kind: 'ok', text: '已套用 — 未啟用' }
    const snap
      = settings.value.filterMode === 'preset'
      && settings.value.selectedPresetIndex >= 0
        ? snapshots.value[settings.value.selectedPresetIndex]
        : undefined
    lastApplied.value = {
      mode: settings.value.filterMode,
      shownUnits: appliedShownUnits.value,
      total: snap ? snap.totalCount : totalCount.value,
      snapshotName: snap?.name,
    }
    if (opts.source === 'filter') {
      applySuccess.value = true
      setTimeout(() => {
        applySuccess.value = false
      }, APPLY_SUCCESS_MS)
    }
  }
  else {
    status.value = { kind: 'error', text: `失敗：${r.error ?? 'unknown'}` }
    toast.show('err', `套用失敗：${r.error ?? 'unknown'}`)
  }
}

async function applyFilter() {
  settings.value.shownUnitsCustom = Array.isArray(draftFilter.value.shownUnitsCustom)
    ? [...draftFilter.value.shownUnitsCustom]
    : draftFilter.value.shownUnitsCustom
  settings.value.filterMode = draftFilter.value.filterMode
  settings.value.selectedPresetIndex = draftFilter.value.selectedPresetIndex
  await sendApply({ source: 'filter' })
}

watch(
  () => [
    settings.value.enabled,
    settings.value.showNeutral,
    settings.value.showAlly,
    settings.value.showEnemy,
    settings.value.showIndicators,
    settings.value.fontSize,
    settings.value.enabledCrateTypes.slice(),
  ],
  () => {
    if (suppressInstant)
      return
    sendApply({ source: 'instant' })
  },
  { deep: true },
)
</script>

<template>
  <main class="bg-background min-h-screen">
    <div
      class="w-full px-4 mx-auto bg-card rounded-none sm:rounded-2xl border border-border overflow-hidden"
    >
      <AppHeader :active="status.kind === 'active'" :version="VERSION" />
      <div class="overflow-y-auto">
        <StatusBar :kind="status.kind" :text="status.text" />
        <SettingsSection
          v-model:enabled="settings.enabled"
          v-model:show-ally="settings.showAlly"
          v-model:show-enemy="settings.showEnemy"
          v-model:show-neutral="settings.showNeutral"
          v-model:show-indicators="settings.showIndicators"
          v-model:font-size="settings.fontSize"
        />
        <CrateSection v-model="settings.enabledCrateTypes" />
        <FilterSection
          v-model:shownUnitsCustom="draftFilter.shownUnitsCustom"
          v-model:filterMode="draftFilter.filterMode"
          v-model:selectedPresetIndex="draftFilter.selectedPresetIndex"
          v-model:totalCount="totalCount"
        />
      </div>
      <ApplyBar
        :disabled="!filterDirty"
        :success="applySuccess"
        label="套用單位篩選"
        @apply="applyFilter"
      />
      <ActiveFilterInfo :applied="lastApplied" />
    </div>
    <Toast />
  </main>
</template>
