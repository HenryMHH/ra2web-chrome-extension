<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRa2Bridge } from '~/popup/composables/useRa2Bridge'
import { useRa2Snapshots } from '~/popup/composables/useRa2Snapshots'

const props = defineProps<{
  hiddenUnitsCustom: string[]
  filterMode: 'custom' | 'preset'
  selectedPresetIndex: number
}>()
const emit = defineEmits<{
  (e: 'update:hiddenUnitsCustom', v: string[]): void
  (e: 'update:filterMode', v: 'custom' | 'preset'): void
  (e: 'update:selectedPresetIndex', v: number): void
}>()

const bridge = useRa2Bridge()
const { snapshots, load: loadSnapshots, add: addSnapshot, remove: removeSnapshot } = useRa2Snapshots()
const allUnits = ref<Array<[string, string]>>([])
const query = ref('')
const snapshotName = ref('')

loadSnapshots()

async function fetchUnits() {
  const r = await bridge.getUnitNames()
  allUnits.value = (r.units ?? []).map(([k, v]) => [k, v])
}
fetchUnits()

const hidden = computed(() => new Set(props.hiddenUnitsCustom))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return allUnits.value
  return allUnits.value.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
})

function toggle(ruleName: string) {
  const next = new Set(hidden.value)
  if (next.has(ruleName))
    next.delete(ruleName)
  else next.add(ruleName)
  emit('update:hiddenUnitsCustom', [...next])
}
function selectAll() {
  emit('update:hiddenUnitsCustom', filtered.value.map(([k]) => k))
}
function selectNone() {
  const remaining = props.hiddenUnitsCustom.filter(k => !filtered.value.some(([fk]) => fk === k))
  emit('update:hiddenUnitsCustom', remaining)
}
async function saveSnapshot() {
  const name = `${snapshotName.value || '未命名'} ${new Date().toISOString()}`
  await addSnapshot({
    name,
    hiddenUnits: [...props.hiddenUnitsCustom],
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
  <details>
    <summary>單位篩選</summary>
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
          <input type="checkbox" :checked="hidden.has(ruleName)" @change="toggle(ruleName)">
          <span class="rn">{{ displayName }}</span>
          <span class="key">{{ ruleName }}</span>
        </label>
      </div>
      <div class="actions">
        <button type="button" @click="selectAll">
          全選
        </button>
        <button type="button" @click="selectNone">
          全不選
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
          {{ s.name }}（{{ s.hiddenUnits.length }}/{{ s.totalCount }}）
        </option>
      </select>
      <button type="button" :disabled="selectedPresetIndex < 0" @click="deleteSelectedPreset">
        刪除
      </button>
    </div>
  </details>
</template>

<style scoped>
.modes { display: flex; gap: 8px; margin: 6px 0; }
.list { max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 4px; }
.item { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.key { color: #888; font-family: monospace; }
.actions, .save, .preset { display: flex; gap: 6px; margin-top: 6px; }
</style>
