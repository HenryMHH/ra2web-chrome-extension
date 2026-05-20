import { ref } from 'vue'
import type { ShownUnits } from './useRa2Settings'

const KEY = 'ra2NamesSnapshots'

export interface Snapshot {
  name: string
  shownUnits: ShownUnits
  totalCount: number
}

interface LegacyShape { hiddenUnits?: string[] }

function isNewShape(s: any): s is Snapshot {
  return s && typeof s === 'object' && 'shownUnits' in s
}

export function useRa2Snapshots() {
  const snapshots = ref<Snapshot[]>([])

  async function load() {
    const obj = await browser.storage.local.get(KEY)
    const list = obj[KEY]
    if (!Array.isArray(list)) {
      snapshots.value = []
      return
    }
    const kept = list.filter(isNewShape) as Snapshot[]
    const droppedLegacy = list.filter((s: any): s is LegacyShape => s && 'hiddenUnits' in s && !('shownUnits' in s))
    if (droppedLegacy.length > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[ra2-names] Dropped ${droppedLegacy.length} legacy snapshot(s); whitelist schema cannot reconstruct old hide-list snapshots.`,
      )
      await browser.storage.local.set({ [KEY]: kept })
    }
    snapshots.value = kept
  }

  async function save() {
    await browser.storage.local.set({ [KEY]: snapshots.value })
  }

  async function add(snapshot: Snapshot) {
    snapshots.value = [...snapshots.value, snapshot]
    await save()
  }

  async function remove(index: number) {
    snapshots.value = snapshots.value.filter((_, i) => i !== index)
    await save()
  }

  return { snapshots, load, add, remove }
}
