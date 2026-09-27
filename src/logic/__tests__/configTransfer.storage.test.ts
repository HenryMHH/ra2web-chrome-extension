import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem: Record<string, any> = {}

const set = vi.fn((obj: Record<string, any>, cb?: () => void) => {
  Object.assign(mem, obj)
  if (cb) {
    cb()
    return undefined
  }
  return Promise.resolve()
})

const get = vi.fn((keys: string | string[], cb?: (r: any) => void) => {
  const list = Array.isArray(keys) ? keys : [keys]
  const r = Object.fromEntries(list.filter(k => k in mem).map(k => [k, mem[k]]))
  if (cb) {
    cb(r)
    return undefined
  }
  return Promise.resolve(r)
})

const storageApi = {
  local: {
    get,
    set,
  },
  onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
}

// Set up globalThis.chrome and globalThis.browser before importing
;(globalThis as any).chrome = {
  runtime: { id: 'test' },
  storage: storageApi,
}

;(globalThis as any).browser = {
  runtime: { id: 'test' },
  storage: storageApi,
}

const { CONFIG_STORAGE_KEYS, readConfigFromStorage, writeConfigToStorage } = await import('../configTransfer')
const { normalizeSettings } = await import('~/composables/useRa2Settings')

beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k])
  set.mockClear()
  get.mockClear()
})

describe('readConfigFromStorage', () => {
  it('returns defaults when storage is empty', async () => {
    const d = await readConfigFromStorage()
    expect(d.settings).toEqual(normalizeSettings(undefined))
    expect(d.snapshots).toEqual([])
    expect(Object.keys(d.playerTags)).toEqual([])
  })

  it('reads and normalizes all three keys', async () => {
    mem.ra2NamesSettings = { enabled: true, fontSize: 16 }
    mem.ra2NamesSnapshots = [{ name: 'a', shownUnits: ['e1'], totalCount: 2 }, { hiddenUnits: ['X'] }]
    mem.ra2PlayerTags = { bob: 'enemy', bad: 'NOPE!' }
    const d = await readConfigFromStorage()
    expect(d.settings.enabled).toBe(true)
    expect(d.settings.fontSize).toBe(16)
    expect(d.snapshots).toEqual([{ name: 'a', shownUnits: ['E1'], totalCount: 2 }])
    expect({ ...d.playerTags }).toEqual({ bob: 'enemy' })
  })
})

describe('writeConfigToStorage', () => {
  it('writes only present sections in a single set call', async () => {
    mem.ra2NamesSettings = { enabled: false }
    await writeConfigToStorage({ snapshots: [{ name: 'x', shownUnits: 'all', totalCount: 0 }] })
    expect(set).toHaveBeenCalledTimes(1)
    expect(set.mock.calls[0][0]).toEqual({ [CONFIG_STORAGE_KEYS.snapshots]: [{ name: 'x', shownUnits: 'all', totalCount: 0 }] })
    expect(mem.ra2NamesSettings).toEqual({ enabled: false })
  })

  it('writes all three sections together', async () => {
    const tags = Object.create(null)
    tags.a = 'newbie'
    await writeConfigToStorage({ settings: normalizeSettings(undefined), snapshots: [], playerTags: tags })
    expect(set).toHaveBeenCalledTimes(1)
    expect(Object.keys(set.mock.calls[0][0]).sort()).toEqual(['ra2NamesSettings', 'ra2NamesSnapshots', 'ra2PlayerTags'])
    expect(mem.ra2PlayerTags).toEqual({ a: 'newbie' })
  })

  it('does nothing when data is empty', async () => {
    await writeConfigToStorage({})
    expect(set).not.toHaveBeenCalled()
  })
})
