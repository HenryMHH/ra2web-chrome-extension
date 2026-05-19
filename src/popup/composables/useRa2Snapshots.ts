const KEY = 'ra2NamesSnapshots'

export interface Snapshot {
  name: string
  hiddenUnits: string[]
  totalCount: number
}

export function useRa2Snapshots() {
  const snapshots = ref<Snapshot[]>([])

  async function load() {
    const obj = await browser.storage.local.get(KEY)
    const list = obj[KEY]
    snapshots.value = Array.isArray(list) ? list : []
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
