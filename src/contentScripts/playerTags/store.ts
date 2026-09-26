import type { PlayerTagId } from '~/constants/playerTags'
import { isPlayerTagId } from '~/constants/playerTags'

export const PLAYER_TAGS_KEY = 'ra2PlayerTags'

export type PlayerTagMap = Record<string, PlayerTagId>

export function normalizeTagMap(raw: unknown): PlayerTagMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return {}
  const out: PlayerTagMap = {}
  for (const [name, id] of Object.entries(raw as Record<string, unknown>)) {
    const key = name.trim()
    if (key && isPlayerTagId(id))
      out[key] = id
  }
  return out
}

export async function loadTags(): Promise<PlayerTagMap> {
  const obj = await browser.storage.local.get(PLAYER_TAGS_KEY)
  return normalizeTagMap(obj[PLAYER_TAGS_KEY])
}

// Read-modify-write against fresh storage: with all_frames several content-script
// instances may be alive, so an in-memory map can be stale.
async function update(mutate: (map: PlayerTagMap) => void): Promise<PlayerTagMap> {
  const map = await loadTags()
  mutate(map)
  await browser.storage.local.set({ [PLAYER_TAGS_KEY]: map })
  return map
}

export function setTag(name: string, id: PlayerTagId): Promise<PlayerTagMap> {
  return update((map) => {
    map[name.trim()] = id
  })
}

export function removeTag(name: string): Promise<PlayerTagMap> {
  return update((map) => {
    delete map[name.trim()]
  })
}

export function onTagsChanged(cb: (map: PlayerTagMap) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !changes[PLAYER_TAGS_KEY])
      return
    cb(normalizeTagMap(changes[PLAYER_TAGS_KEY].newValue))
  }
  browser.storage.onChanged.addListener(listener)
  return () => browser.storage.onChanged.removeListener(listener)
}
