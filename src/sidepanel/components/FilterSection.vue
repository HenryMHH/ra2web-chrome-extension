<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppCheckbox from '~/components/ui/AppCheckbox.vue'
import AppCollapsible from '~/components/ui/AppCollapsible.vue'
import AppTabs from '~/components/ui/AppTabs.vue'
import { useRa2Bridge } from '~/popup/composables/useRa2Bridge'
import { useRa2Snapshots } from '~/popup/composables/useRa2Snapshots'
import type { ShownUnits } from '~/popup/composables/useRa2Settings'

const props = defineProps<{
  shownUnitsCustom: ShownUnits
  filterMode: 'custom' | 'preset'
  selectedPresetIndex: number
}>()
const emit = defineEmits<{
  'update:shownUnitsCustom': [v: ShownUnits]
  'update:filterMode': [v: 'custom' | 'preset']
  'update:selectedPresetIndex': [v: number]
  'update:totalCount': [v: number]
}>()

const bridge = useRa2Bridge()
const {
  snapshots,
  load: loadSnapshots,
  add: addSnapshot,
  remove: removeSnapshot,
} = useRa2Snapshots()
const allUnits = ref<Array<[string, string]>>([])
const query = ref('')
const snapshotName = ref('')
const fetching = ref(false)
const open = ref(true)

loadSnapshots()

async function fetchUnits() {
  if (fetching.value)
    return
  fetching.value = true
  try {
    const r = await bridge.getUnitNames()
    allUnits.value = Array.isArray(r?.units)
      ? r.units.map(([k, v]) => [k, v])
      : []
    emit('update:totalCount', allUnits.value.length)
  }
  finally {
    fetching.value = false
  }
}
function onVisibility() {
  if (document.visibilityState === 'visible')
    fetchUnits()
}
onMounted(() => {
  fetchUnits()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
})

const isShownAll = computed(() => props.shownUnitsCustom === 'all')
const explicit = computed<Set<string>>(() =>
  props.shownUnitsCustom === 'all'
    ? new Set()
    : new Set(props.shownUnitsCustom),
)
function isChecked(rn: string) {
  return isShownAll.value || explicit.value.has(rn)
}
const checkedCount = computed(() =>
  isShownAll.value
    ? allUnits.value.length
    : (props.shownUnitsCustom as string[]).length,
)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return allUnits.value
  return allUnits.value.filter(
    ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q),
  )
})
function toggle(rn: string) {
  const all = allUnits.value.map(([k]) => k)
  let set: Set<string>
  if (isShownAll.value) {
    set = new Set(all)
    set.delete(rn)
  }
  else {
    set = new Set(props.shownUnitsCustom as string[])
    if (set.has(rn))
      set.delete(rn)
    else set.add(rn)
  }
  if (set.size === all.length && all.every(k => set.has(k))) {
    emit('update:shownUnitsCustom', 'all')
    return
  }
  emit('update:shownUnitsCustom', [...set])
}
function showAll() {
  emit('update:shownUnitsCustom', 'all')
}
function hideAll() {
  emit('update:shownUnitsCustom', [])
}
async function saveSnapshot() {
  const name = `${snapshotName.value || '未命名'} ${new Date().toISOString()}`
  await addSnapshot({
    name,
    shownUnits:
      props.shownUnitsCustom === 'all' ? 'all' : [...props.shownUnitsCustom],
    totalCount: allUnits.value.length,
  })
  snapshotName.value = ''
}
async function deleteSelectedPreset() {
  if (props.selectedPresetIndex < 0)
    return
  await removeSnapshot(props.selectedPresetIndex)
  emit('update:selectedPresetIndex', -1)
}
</script>

<template>
  <div class="border-t border-border">
    <AppCollapsible v-model:open="open" title="單位篩選">
      <div class="space-y-3">
        <AppTabs
          :model-value="filterMode"
          :tabs="[
            { value: 'custom', label: '單場自訂' },
            { value: 'preset', label: '快照' },
          ]"
          @update:model-value="
            $emit('update:filterMode', $event as 'custom' | 'preset')
          "
        >
          <template #custom>
            <div class="relative">
              <input
                v-model="query"
                type="text"
                placeholder="搜尋單位名稱…"
                class="w-full rounded-md border border-border bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              已勾選 {{ checkedCount }} / {{ allUnits.length }}（✅ 勾起來 = 顯示）
            </p>
            <div class="flex gap-2 mt-2">
              <button
                type="button"
                class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                @click="showAll"
              >
                全部顯示
              </button>
              <button
                type="button"
                class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                @click="hideAll"
              >
                全部隱藏
              </button>
              <button
                type="button"
                class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                :disabled="fetching"
                @click="fetchUnits"
              >
                {{ fetching ? "抓取中…" : "重新整理" }}
              </button>
            </div>
            <div class="space-y-1 max-h-48 overflow-y-auto pr-1 mt-2">
              <label
                v-for="[rn, dn] in filtered"
                :key="rn"
                class="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors group"
              >
                <div class="flex items-center gap-3">
                  <AppCheckbox
                    :model-value="isChecked(rn)"
                    @update:model-value="toggle(rn)"
                  />
                  <span class="text-sm text-foreground">{{ dn }}</span>
                </div>
                <span
                  class="text-xs font-mono text-muted-foreground group-hover:text-secondary-foreground transition-colors"
                >{{ rn }}</span>
              </label>
              <p
                v-if="allUnits.length === 0 && !fetching"
                class="text-xs text-destructive p-2"
              >
                尚未抓到單位清單。請先進入對局，再按「重新整理」。
              </p>
            </div>
            <div class="flex gap-2 mt-2">
              <input
                v-model="snapshotName"
                placeholder="快照名稱"
                class="flex-1 rounded-md border border-border bg-input/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
              <button
                type="button"
                class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                @click="saveSnapshot"
              >
                儲存快照
              </button>
            </div>
          </template>
          <template #preset>
            <select
              :value="selectedPresetIndex"
              class="w-full rounded-md border border-border bg-input/30 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>option]:text-white [&>option]:bg-card"
              @change="
                $emit(
                  'update:selectedPresetIndex',
                  Number(($event.target as HTMLSelectElement).value),
                )
              "
            >
              <option :value="-1" class="text-white bg-card">
                — 選擇快照 —
              </option>
              <option
                v-for="(s, i) in snapshots"
                :key="i"
                :value="i"
                class="text-white bg-card"
              >
                {{ s.name }}（{{
                  Array.isArray(s.shownUnits) ? s.shownUnits.length : "全部"
                }}/{{ s.totalCount }}）
              </option>
            </select>
            <button
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground mt-2 disabled:opacity-50"
              :disabled="selectedPresetIndex < 0"
              @click="deleteSelectedPreset"
            >
              刪除選中快照
            </button>
          </template>
        </AppTabs>
      </div>
    </AppCollapsible>
  </div>
</template>
