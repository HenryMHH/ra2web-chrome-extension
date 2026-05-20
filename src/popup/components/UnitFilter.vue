<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRa2Bridge } from '~/popup/composables/useRa2Bridge'
import { useRa2Snapshots } from '~/popup/composables/useRa2Snapshots'
import type { ShownUnits } from '~/popup/composables/useRa2Settings'

const props = defineProps<{
  shownUnitsCustom: ShownUnits
  filterMode: 'custom' | 'preset'
  selectedPresetIndex: number
}>()
const emit = defineEmits<{
  (e: 'update:shownUnitsCustom', v: ShownUnits): void
  (e: 'update:filterMode', v: 'custom' | 'preset'): void
  (e: 'update:selectedPresetIndex', v: number): void
  (e: 'update:totalCount', v: number): void
}>()

const bridge = useRa2Bridge()
const { snapshots, load: loadSnapshots, add: addSnapshot, remove: removeSnapshot } = useRa2Snapshots()
const allUnits = ref<Array<[string, string]>>([])
const query = ref('')
const snapshotName = ref('')
const fetching = ref(false)
const lastSource = ref<string>('')

loadSnapshots()

async function fetchUnits() {
  if (fetching.value)
    return
  fetching.value = true
  try {
    const r = await bridge.getUnitNames()
    const units = Array.isArray(r?.units) ? r.units : []
    allUnits.value = units.map(([k, v]) => [k, v])
    emit('update:totalCount', allUnits.value.length)
    lastSource.value = r?.source ?? 'none'
  }
  catch (e) {
    console.warn('[ra2-names] fetchUnits failed:', e)
    lastSource.value = 'error'
  }
  finally {
    fetching.value = false
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible')
    fetchUnits()
}
function onDetailsToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open)
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
const explicitShown = computed<Set<string>>(() => {
  if (props.shownUnitsCustom === 'all')
    return new Set()
  return new Set(props.shownUnitsCustom)
})

function isChecked(ruleName: string): boolean {
  return isShownAll.value || explicitShown.value.has(ruleName)
}

const checkedCount = computed<number>(() => {
  if (props.shownUnitsCustom === 'all')
    return allUnits.value.length
  return props.shownUnitsCustom.length
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return allUnits.value
  return allUnits.value.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
})

function emitShown(next: ShownUnits) {
  emit('update:shownUnitsCustom', next)
}

function toggle(ruleName: string) {
  const all = allUnits.value.map(([k]) => k)
  let nextSet: Set<string>
  if (isShownAll.value) {
    nextSet = new Set(all)
    nextSet.delete(ruleName)
  }
  else {
    nextSet = new Set(props.shownUnitsCustom as string[])
    if (nextSet.has(ruleName))
      nextSet.delete(ruleName)
    else nextSet.add(ruleName)
  }
  if (nextSet.size === all.length && all.every(k => nextSet.has(k))) {
    emitShown('all')
    return
  }
  emitShown([...nextSet])
}

function showAll() {
  emitShown('all')
}
function hideAll() {
  emitShown([])
}

async function saveSnapshot() {
  const name = `${snapshotName.value || '未命名'} ${new Date().toISOString()}`
  await addSnapshot({
    name,
    shownUnits: props.shownUnitsCustom === 'all' ? 'all' : [...props.shownUnitsCustom],
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
  <details @toggle="onDetailsToggle">
    <summary>單位篩選</summary>

    <div class="head">
      <span class="meta">
        {{ allUnits.length }} 筆
        <span v-if="lastSource" class="src">({{ lastSource }})</span>
      </span>
      <button
        type="button"
        data-testid="unit-refresh"
        :disabled="fetching"
        @click="fetchUnits"
      >
        {{ fetching ? '抓取中…' : '重新整理' }}
      </button>
    </div>

    <p class="hint">
      ✅ 勾起來 = 顯示這個單位的名稱
    </p>

    <p data-testid="filter-count-label" class="count">
      已勾選 {{ checkedCount }} / {{ allUnits.length }}
    </p>

    <p v-if="allUnits.length === 0 && !fetching" class="empty">
      尚未抓到單位清單。請先進入對局，再按「重新整理」。
    </p>

    <div class="modes">
      <label>
        <input
          type="radio"
          :checked="filterMode === 'custom'"
          @change="$emit('update:filterMode', 'custom')"
        > 自訂
      </label>
      <label>
        <input
          type="radio"
          :checked="filterMode === 'preset'"
          @change="$emit('update:filterMode', 'preset')"
        > 快照
      </label>
    </div>

    <div v-if="filterMode === 'custom'" class="custom">
      <input v-model="query" placeholder="搜尋…">
      <div class="list">
        <label v-for="[ruleName, displayName] in filtered" :key="ruleName" class="item">
          <input type="checkbox" :checked="isChecked(ruleName)" @change="toggle(ruleName)">
          <span class="rn">{{ displayName }}</span>
          <span class="key">{{ ruleName }}</span>
        </label>
      </div>
      <div class="actions">
        <button type="button" data-testid="unit-show-all" @click="showAll">
          全部顯示
        </button>
        <button type="button" data-testid="unit-hide-all" @click="hideAll">
          全部隱藏
        </button>
      </div>
      <div class="save">
        <input v-model="snapshotName" placeholder="快照名稱">
        <button type="button" @click="saveSnapshot">
          儲存快照
        </button>
      </div>
    </div>

    <div v-else class="preset">
      <select
        :value="selectedPresetIndex"
        @change="$emit('update:selectedPresetIndex', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="-1">
          — 選擇快照 —
        </option>
        <option v-for="(s, i) in snapshots" :key="i" :value="i">
          {{ s.name }}（{{ Array.isArray(s.shownUnits) ? s.shownUnits.length : '全部' }}/{{ s.totalCount }}）
        </option>
      </select>
      <button type="button" :disabled="selectedPresetIndex < 0" @click="deleteSelectedPreset">
        刪除
      </button>
    </div>
  </details>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; }
.meta { font-size: 12px; color: #666; }
.src { color: #888; font-family: monospace; }
.hint { font-size: 11px; color: #555; background: #f6f6f6; padding: 4px 6px; border-radius: 3px; margin: 4px 0; }
.count { font-size: 11px; color: #555; margin: 2px 0; }
.empty { font-size: 12px; color: #b00; margin: 6px 0; }
.modes { display: flex; gap: 8px; margin: 6px 0; }
.list { max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 4px; }
.item { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.key { color: #888; font-family: monospace; }
.actions, .save, .preset { display: flex; gap: 6px; margin-top: 6px; }
</style>
