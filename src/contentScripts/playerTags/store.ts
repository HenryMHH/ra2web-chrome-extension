import type { PlayerTagId } from '~/constants/playerTags'
import { isValidTagId } from '~/constants/playerTags'

export const PLAYER_TAGS_KEY = 'ra2PlayerTags'

export type PlayerTagMap = Record<string, PlayerTagId>

// Null-prototype: a player literally named "constructor"/"toString"/etc. must not resolve to
// an inherited Object.prototype member on lookup, and a player named "__proto__" must be a real
// own property instead of silently hitting the (no-op, for a non-object value) [[Prototype]]
// setter that a plain `{}` would expose for that key.
export function emptyTagMap(): PlayerTagMap {
  return Object.create(null)
}

export function normalizeTagMap(raw: unknown): PlayerTagMap {
  const out = emptyTagMap()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return out
  for (const [name, id] of Object.entries(raw as Record<string, unknown>)) {
    const key = name.trim()
    // Format check only: a custom tag's def may live in ra2CustomPlayerTags (or be missing after
    // a delete elsewhere) — existence is resolved at render time, where a missing def = untagged.
    if (key && isValidTagId(id))
      out[key] = id
  }
  return out
}

// Shallow-clone a tag map while preserving the null-prototype invariant above. Spreading with
// `{ ...map }` (or Object.fromEntries) always produces a normal Object.prototype-based object,
// which would silently reintroduce the same lookup hazard for the next read.
export function cloneTagMap(map: PlayerTagMap): PlayerTagMap {
  return Object.assign(emptyTagMap(), map)
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
