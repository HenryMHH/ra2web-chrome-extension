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

const { PLAYER_TAGS, getPlayerTag, isPlayerTagId } = await import('~/constants/playerTags')
const { PLAYER_TAGS_KEY, loadTags, normalizeTagMap, onTagsChanged, removeTag, setTag } = await import('../store')

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

  it('isPlayerTagId accepts only known ids', () => {
    expect(isPlayerTagId('enemy')).toBe(true)
    expect(isPlayerTagId('friend')).toBe(false)
    expect(isPlayerTagId(1)).toBe(false)
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

  it('drops invalid tag ids and blank names, trims names', () => {
    expect(normalizeTagMap({ ' alice ': 'enemy', 'bob': 'friend', '  ': 'reliable' })).toEqual({ alice: 'enemy' })
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
