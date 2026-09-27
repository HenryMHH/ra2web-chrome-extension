import { ref } from 'vue'
import type { PlayerTagDef, PlayerTagId } from '~/constants/playerTags'
import {
  countTagsWithId,
  deleteCustomTag,
  loadCustomTags,
  loadTags,
  onCustomTagsChanged,
  upsertCustomTag,
} from '~/contentScripts/playerTags/store'

// Module-level so every component (PlayerTagSection, Sidepanel's post-import reload) shares one
// list — same pattern as useRa2Snapshots.
const customTags = ref<PlayerTagDef[]>([])
let listenerInstalled = false

function installListener() {
  if (listenerInstalled || typeof browser === 'undefined' || !browser.storage?.onChanged)
    return
  listenerInstalled = true
  onCustomTagsChanged((list) => {
    customTags.value = list
  })
}

export function useCustomPlayerTags() {
  installListener()

  async function load() {
    customTags.value = await loadCustomTags()
  }

  async function upsert(def: PlayerTagDef) {
    customTags.value = await upsertCustomTag(def)
  }

  async function remove(id: PlayerTagId): Promise<number> {
    const r = await deleteCustomTag(id)
    customTags.value = r.list
    return r.removedAssignments
  }

  async function countAssignments(id: PlayerTagId): Promise<number> {
    return countTagsWithId(await loadTags(), id)
  }

  return { customTags, load, upsert, remove, countAssignments }
}
