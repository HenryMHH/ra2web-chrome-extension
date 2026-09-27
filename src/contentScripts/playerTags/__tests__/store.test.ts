import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal chrome.storage mock (same pattern as composables/__tests__/useRa2Snapshots.test.ts).
// webextension-polyfill wraps `chrome`, so it must exist before the dynamic import below.
const mem: Record<string, any> = {}
const changeListeners: Array<(changes: any, area: string) => void> = []

const storageApi = {
  local: {
    get: (key: string, cb?: (r: any) => void) => {
      const r = key in mem ? { [key]: JSON.parse(JSON.stringify(mem[key])) } : {}
      if (cb) {
        cb(r)
        return undefined
      }
      return Promise.resolve(r)
    },
    set: (obj: Record<string, any>, cb?: () => void) => {
      const changes: Record<string, any> = {}
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: mem[k], newValue: v }
        mem[k] = v
      }
      changeListeners.forEach(l => l(changes, 'local'))
      if (cb) {
        cb()
        return undefined
      }
      return Promise.resolve()
    },
  },
  onChanged: {
    addListener: (l: any) => changeListeners.push(l),
    removeListener: (l: any) => {
      const i = changeListeners.indexOf(l)
      if (i >= 0)
        changeListeners.splice(i, 1)
    },
    hasListener: vi.fn(),
  },
}

;(globalThis as any).chrome = {
  runtime: { id: 'test' },
  storage: storageApi,
}

// browser is the webextension-polyfill export that wraps chrome
;(globalThis as any).browser = {
  runtime: { id: 'test' },
  storage: storageApi,
}

const { PLAYER_TAGS, getPlayerTag, isBuiltinTagId } = await import('~/constants/playerTags')
const { PLAYER_TAGS_KEY, loadTags, normalizeTagMap, onTagsChanged, removeTag, setTag, CUSTOM_TAGS_KEY, countTagsWithId, deleteCustomTag, loadCustomTags, onCustomTagsChanged, upsertCustomTag } = await import('../store')

beforeEach(() => {
  for (const k of Object.keys(mem))
    delete mem[k]
})

describe('player tag constants', () => {
  it('defines the four tags in fixed order with zh-Hant labels', () => {
    expect(PLAYER_TAGS.map(t => [t.id, t.label])).toEqual([
      ['reliable', '可靠'],
      ['enemy', '敵人'],
      ['selfish', '自私'],
      ['newbie', '新手'],
    ])
  })

  it('isBuiltinTagId accepts only builtin ids', () => {
    expect(isBuiltinTagId('enemy')).toBe(true)
    expect(isBuiltinTagId('friend')).toBe(false)
    expect(isBuiltinTagId(1)).toBe(false)
  })

  it('getPlayerTag returns the def', () => {
    expect(getPlayerTag('newbie')!.label).toBe('新手')
  })

  it('getPlayerTag returns undefined (not a throwing accessor) for an unknown id', () => {
    expect(getPlayerTag('not-a-real-tag' as any)).toBeUndefined()
  })
})

describe('normalizeTagMap', () => {
  it('drops non-object input', () => {
    expect(normalizeTagMap(undefined)).toEqual({})
    expect(normalizeTagMap(['enemy'])).toEqual({})
    expect(normalizeTagMap('x')).toEqual({})
  })

  it('drops malformed tag ids and blank names, trims names; keeps well-formed custom ids', () => {
    expect(normalizeTagMap({ ' alice ': 'enemy', 'bob': 'Not Valid!', 'carol': 'camper', '  ': 'reliable', 'dan': 7 }))
      .toEqual({ alice: 'enemy', carol: 'camper' })
  })
})

describe('store', () => {
  it('loadTags returns {} when nothing stored', async () => {
    expect(await loadTags()).toEqual({})
  })

  it('setTag writes under ra2PlayerTags and preserves other entries', async () => {
    mem[PLAYER_TAGS_KEY] = { alice: 'reliable' }
    const map = await setTag('bob', 'enemy')
    expect(map).toEqual({ alice: 'reliable', bob: 'enemy' })
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ alice: 'reliable', bob: 'enemy' })
  })

  it('setTag reads fresh storage (does not clobber writes from another frame)', async () => {
    await setTag('alice', 'reliable')
    mem[PLAYER_TAGS_KEY] = { ...mem[PLAYER_TAGS_KEY], carol: 'selfish' } // other frame wrote
    await setTag('bob', 'newbie')
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ alice: 'reliable', carol: 'selfish', bob: 'newbie' })
  })

  it('setTag trims the name', async () => {
    await setTag('  dave\n', 'enemy')
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ dave: 'enemy' })
  })

  it('removeTag deletes only that name', async () => {
    mem[PLAYER_TAGS_KEY] = { alice: 'reliable', bob: 'enemy' }
    const map = await removeTag('alice')
    expect(map).toEqual({ bob: 'enemy' })
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ bob: 'enemy' })
  })

  it('onTagsChanged fires with normalized map for our key only, and unsubscribes', async () => {
    const cb = vi.fn()
    const off = onTagsChanged(cb)
    await (globalThis as any).chrome.storage.local.set({ unrelated: 1 })
    expect(cb).not.toHaveBeenCalled()
    await setTag('eve', 'selfish')
    expect(cb).toHaveBeenLastCalledWith({ eve: 'selfish' })
    off()
    await setTag('frank', 'enemy')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('prototype-pollution safety', () => {
  it('normalizeTagMap returns a null-prototype map (no inherited Object.prototype members)', () => {
    const map = normalizeTagMap({ alice: 'reliable' })
    expect(Object.getPrototypeOf(map)).toBeNull()
    // A player literally named "constructor"/"toString" must not resolve to an
    // inherited function via property lookup when no such entry was ever set.
    expect((map as any).constructor).toBeUndefined()
    expect((map as any).toString).toBeUndefined()
    expect((map as any).hasOwnProperty).toBeUndefined()
  })

  it('a player named "__proto__" round-trips through setTag/loadTags/normalizeTagMap', async () => {
    await setTag('__proto__', 'enemy')
    const map = await loadTags()
    // Must be a real OWN property with the tag value, not the exotic [[Prototype]] setter
    // silently swallowing the write (which is what a plain-object map does).
    expect(Object.getOwnPropertyDescriptor(map, '__proto__')?.value).toBe('enemy')
    expect(Object.getPrototypeOf(map)).toBeNull()
    expect(Object.keys(map)).toEqual(['__proto__'])

    await removeTag('__proto__')
    const map2 = await loadTags()
    expect(Object.keys(map2)).toEqual([])
  })
})

describe('custom tag storage', () => {
  const camper = { id: 'camper', label: '蹲家', bg: '#9333ea' }

  it('loadCustomTags returns [] when nothing stored and normalizes stored values', async () => {
    expect(await loadCustomTags()).toEqual([])
    mem[CUSTOM_TAGS_KEY] = [camper, { id: 'enemy', label: 'x', bg: '#000000' }]
    expect(await loadCustomTags()).toEqual([camper])
  })

  it('upsertCustomTag appends a new id', async () => {
    const list = await upsertCustomTag(camper)
    expect(list).toEqual([camper])
    expect(mem[CUSTOM_TAGS_KEY]).toEqual([camper])
  })

  it('upsertCustomTag replaces an existing id in place (order kept) and reads fresh storage', async () => {
    mem[CUSTOM_TAGS_KEY] = [camper, { id: 'rusher', label: '快攻', bg: '#dc2626' }]
    await upsertCustomTag({ id: 'camper', label: '龜', bg: '#16a34a' })
    expect(mem[CUSTOM_TAGS_KEY]).toEqual([
      { id: 'camper', label: '龜', bg: '#16a34a' },
      { id: 'rusher', label: '快攻', bg: '#dc2626' },
    ])
  })

  it('upsertCustomTag rejects (and writes nothing) when the cap drops the new tag', async () => {
    const full = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, label: `x${i}`, bg: '#000000' }))
    mem[CUSTOM_TAGS_KEY] = full
    await expect(upsertCustomTag({ id: 'extra', label: 'x', bg: '#000000' })).rejects.toThrow('自訂標籤無效或已達上限')
    expect(mem[CUSTOM_TAGS_KEY]).toHaveLength(20)
    expect(mem[CUSTOM_TAGS_KEY].some((t: any) => t.id === 'extra')).toBe(false)
  })

  it('upsertCustomTag rejects (and writes nothing) for an invalid def', async () => {
    await expect(upsertCustomTag({ id: 'camper', label: '蹲家', bg: 'red' })).rejects.toThrow('自訂標籤無效或已達上限')
    expect(mem[CUSTOM_TAGS_KEY]).toBeUndefined()
  })

  it('countTagsWithId counts assignments of one id', () => {
    expect(countTagsWithId(normalizeTagMap({ a: 'camper', b: 'enemy', c: 'camper' }), 'camper')).toBe(2)
  })

  it('deleteCustomTag removes the def and every assignment to it in one write', async () => {
    mem[CUSTOM_TAGS_KEY] = [camper]
    mem[PLAYER_TAGS_KEY] = { alice: 'camper', bob: 'enemy', carol: 'camper' }
    const r = await deleteCustomTag('camper')
    expect(r).toEqual({ list: [], removedAssignments: 2 })
    expect(mem[CUSTOM_TAGS_KEY]).toEqual([])
    expect({ ...mem[PLAYER_TAGS_KEY] }).toEqual({ bob: 'enemy' })
  })

  it('deleteCustomTag refuses builtin ids (must never wipe builtin assignments)', async () => {
    mem[PLAYER_TAGS_KEY] = { bob: 'enemy' }
    await expect(deleteCustomTag('enemy')).rejects.toThrow()
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ bob: 'enemy' })
  })

  it('onCustomTagsChanged fires with a normalized list for our key only, and unsubscribes', async () => {
    const cb = vi.fn()
    const off = onCustomTagsChanged(cb)
    await setTag('x', 'enemy')
    expect(cb).not.toHaveBeenCalled()
    await upsertCustomTag(camper)
    expect(cb).toHaveBeenLastCalledWith([camper])
    off()
    await upsertCustomTag({ ...camper, label: 'y' })
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
