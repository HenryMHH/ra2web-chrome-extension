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
import GeneralSettingsSection from '~/sidepanel/components/GeneralSettingsSection.vue'
import type { ConfigData, ImportSummary } from '~/logic/configTransfer'
import {
  MAX_CONFIG_FILE_BYTES,
  buildConfigFile,
  configFileName,
  parseConfigFile,
  readConfigFromStorage,
  writeConfigToStorage,
} from '~/logic/configTransfer'
import { downloadTextFile, readFileText } from '~/logic/fileIO'
import type { ShownUnits } from '~/composables/useRa2Settings'
import { useRa2Settings } from '~/composables/useRa2Settings'
import { useRa2Snapshots } from '~/composables/useRa2Snapshots'
import { useCustomPlayerTags } from '~/composables/useCustomPlayerTags'
import { useRa2Bridge } from '~/composables/useRa2Bridge'
import { useToast } from '~/composables/useToast'

const { settings, ready, load, save } = useRa2Settings()
const { snapshots, load: loadSnapshots } = useRa2Snapshots()
const { load: loadCustomTags } = useCustomPlayerTags()
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

async function reloadFromStorage() {
  await Promise.all([load(), loadSnapshots(), loadCustomTags()])
  if (settings.value.selectedPresetIndex >= snapshots.value.length)
    settings.value.selectedPresetIndex = -1
  syncDraftFromSettings()
}

async function init() {
  await reloadFromStorage()
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

async function sendApply(opts: { source: 'instant' | 'filter' }): Promise<boolean> {
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
    return true
  }
  else {
    status.value = { kind: 'error', text: `失敗：${r.error ?? 'unknown'}` }
    toast.show('err', `套用失敗：${r.error ?? 'unknown'}`)
    return false
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

const pendingImport = ref<{ data: ConfigData, summary: ImportSummary } | null>(null)
const configBusy = ref(false)

async function exportConfig() {
  try {
    const now = new Date()
    const file = buildConfigFile(await readConfigFromStorage(), now)
    downloadTextFile(configFileName(now), JSON.stringify(file, null, 2))
    toast.show('ok', '已匯出設定檔')
  }
  catch (e) {
    toast.show('err', `匯出失敗:${(e as Error)?.message ?? 'unknown'}`)
  }
}

async function pickConfigFile(file: File) {
  // Reject on the File's own size before reading the whole thing into memory;
  // parseConfigFile's text.length check stays as a backstop (e.g. multi-byte
  // inflation), but this avoids ever loading an oversized file into a string.
  if (file.size > MAX_CONFIG_FILE_BYTES) {
    toast.show('err', '檔案過大(上限 1 MB)')
    return
  }
  let text: string
  try {
    text = await readFileText(file)
  }
  catch {
    toast.show('err', '無法讀取檔案')
    return
  }
  const r = parseConfigFile(text)
  if (!r.ok) {
    toast.show('err', r.error)
    return
  }
  pendingImport.value = { data: r.data, summary: r.summary }
}

async function confirmImport() {
  const p = pendingImport.value
  if (!p)
    return
  configBusy.value = true
  suppressInstant = true
  try {
    // Clamp selectedPresetIndex against the snapshot list that will exist
    // after import *before* writing, so the bytes we write already equal
    // what reloadFromStorage's clamp + sendApply's save() will produce.
    // Otherwise a storage.onChanged echo of the unclamped write can arrive
    // after suppressInstant flips back to false and — since it differs from
    // the now-clamped settings.value — the useRa2Settings listener reassigns
    // settings.value, reverting the clamp and firing an unguarded extra apply.
    // Built as a local copy rather than reassigning p.data.settings, so
    // pendingImport's own object is never mutated (needed for retry after a
    // failed write, and just generally not our object to mutate).
    let data = p.data
    if (data.settings) {
      const snapCount = (data.snapshots ?? snapshots.value).length
      const clampedSettings = data.settings.selectedPresetIndex >= snapCount
        ? { ...data.settings, selectedPresetIndex: -1 }
        : data.settings
      data = { ...data, settings: clampedSettings }
    }
    await writeConfigToStorage(data)
    await reloadFromStorage()
    await nextTick()
    // Storage write + reload succeeding *is* the success boundary — clear the
    // pending box and unblock the UI here, without waiting on `apply`.
    // `apply` round-trips through webext-bridge `sendMessage(..., {
    // context: 'content-script', tabId })`, which (webext-bridge 6.0.1) never
    // rejects for an undeliverable message: if the active tab isn't a game
    // tab (or has no content script), it just queues forever. Awaiting it
    // here would leave configBusy stuck true and every button disabled even
    // though the import already succeeded. A later-opened game tab still
    // picks up the imported settings — its content script auto-applies from
    // storage on `ready`.
    suppressInstant = false
    pendingImport.value = null
    configBusy.value = false
    toast.show('ok', '已匯入設定檔')
    // Fire-and-forget: sendApply already shows its own error toast and
    // updates the status bar on `{ ok: false }`. The .catch only guards
    // against the promise rejecting outright so it can't surface as an
    // unhandled rejection.
    void sendApply({ source: 'instant' }).catch(() => {})
  }
  catch (e) {
    // Leave pendingImport set so the user can retry the same import.
    toast.show('err', `匯入失敗:${(e as Error)?.message ?? 'unknown'}`)
  }
  finally {
    suppressInstant = false
    configBusy.value = false
  }
}

function cancelImport() {
  pendingImport.value = null
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
        <GeneralSettingsSection
          :pending="pendingImport?.summary ?? null"
          :busy="configBusy"
          @export="exportConfig"
          @pick="pickConfigFile"
          @confirm="confirmImport"
          @cancel="cancelImport"
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
