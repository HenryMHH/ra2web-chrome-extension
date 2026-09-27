import { describe, expect, it } from 'vitest'

// Minimal chrome.storage mock (same pattern as playerTags/store.test.ts).
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
  },
}

;(globalThis as any).chrome = {
  runtime: { id: 'test' },
  storage: storageApi,
}

;(globalThis as any).browser = {
  runtime: { id: 'test' },
  storage: storageApi,
}

const {
  CONFIG_FILE_FORMAT,
  CONFIG_FILE_VERSION,
  MAX_CONFIG_FILE_BYTES,
  buildConfigFile,
  configFileName,
  parseConfigFile,
} = await import('../configTransfer')
const { normalizeSettings } = await import('~/composables/useRa2Settings')
const { emptyTagMap } = await import('~/contentScripts/playerTags/store')

function wrap(data: unknown, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ format: CONFIG_FILE_FORMAT, version: 1, exportedAt: 'x', data, ...extra })
}

describe('buildConfigFile', () => {
  it('wraps data with format, version and ISO timestamp', () => {
    const settings = normalizeSettings(undefined)
    const tags = emptyTagMap()
    tags.alice = 'enemy'
    const f = buildConfigFile(
      { settings, snapshots: [{ name: 's', shownUnits: ['E1'], totalCount: 3 }], playerTags: tags },
      new Date('2026-09-27T12:00:00.000Z'),
    )
    expect(f.format).toBe(CONFIG_FILE_FORMAT)
    expect(f.version).toBe(CONFIG_FILE_VERSION)
    expect(f.exportedAt).toBe('2026-09-27T12:00:00.000Z')
    expect(f.data.settings).toEqual(settings)
    expect(f.data.snapshots).toHaveLength(1)
    expect(f.data.playerTags).toEqual({ alice: 'enemy' })
  })

  it('round-trips through parseConfigFile', () => {
    const settings = { ...normalizeSettings(undefined), enabled: true, fontSize: 18, enabledCrateTypes: [0, 3] }
    const tags = emptyTagMap()
    tags.bob = 'newbie'
    const snapshots = [{ name: 's', shownUnits: ['E1'] as string[], totalCount: 3 }]
    const text = JSON.stringify(buildConfigFile({ settings, snapshots, playerTags: tags }, new Date()))
    const r = parseConfigFile(text)
    expect(r.ok).toBe(true)
    if (!r.ok)
      return
    expect(r.data.settings).toEqual(settings)
    expect(r.data.snapshots).toEqual(snapshots)
    expect({ ...r.data.playerTags }).toEqual({ bob: 'newbie' })
    expect(r.summary).toEqual({ settings: true, snapshotCount: 1, playerTagCount: 1 })
  })
})

describe('parseConfigFile — rejects', () => {
  it('invalid JSON', () => {
    expect(parseConfigFile('{nope')).toEqual({ ok: false, error: '檔案不是有效的 JSON' })
  })

  it('wrong format marker', () => {
    const r = parseConfigFile(JSON.stringify({ format: 'other', version: 1, data: {} }))
    expect(r).toEqual({ ok: false, error: '這不是 Ra2Web Assistant 的設定檔' })
  })

  it('non-object top level', () => {
    expect(parseConfigFile('[]')).toEqual({ ok: false, error: '這不是 Ra2Web Assistant 的設定檔' })
    expect(parseConfigFile('null')).toEqual({ ok: false, error: '這不是 Ra2Web Assistant 的設定檔' })
  })

  it('newer version', () => {
    const r = parseConfigFile(wrap({ settings: {} }, { version: CONFIG_FILE_VERSION + 1 }))
    expect(r).toEqual({ ok: false, error: `設定檔版本 v${CONFIG_FILE_VERSION + 1} 比目前支援的 v${CONFIG_FILE_VERSION} 新,請先更新擴充功能` })
  })

  it('non-numeric version', () => {
    const r = parseConfigFile(wrap({ settings: {} }, { version: '1' }))
    expect(r).toEqual({ ok: false, error: '這不是 Ra2Web Assistant 的設定檔' })
  })

  it('no importable section', () => {
    expect(parseConfigFile(wrap({}))).toEqual({ ok: false, error: '設定檔內沒有可匯入的資料' })
  })

  it('oversized text', () => {
    const big = 'x'.repeat(MAX_CONFIG_FILE_BYTES + 1)
    expect(parseConfigFile(big)).toEqual({ ok: false, error: '檔案過大(上限 1 MB)' })
  })
})

describe('parseConfigFile — sanitizes', () => {
  it('only reports sections present in file', () => {
    const r = parseConfigFile(wrap({ playerTags: { a: 'reliable' } }))
    expect(r.ok && r.summary).toEqual({ settings: false, snapshotCount: null, playerTagCount: 1 })
    expect(r.ok && 'settings' in r.data).toBe(false)
    expect(r.ok && 'snapshots' in r.data).toBe(false)
  })

  it('clamps fontSize and filters unknown / duplicate crate ids', () => {
    const r = parseConfigFile(wrap({ settings: { fontSize: 99, enabledCrateTypes: [0, 0, 9, 3, 'x'] } }))
    expect(r.ok).toBe(true)
    if (!r.ok)
      return
    expect(r.data.settings!.fontSize).toBe(20)
    expect(r.data.settings!.enabledCrateTypes).toEqual([0, 3])
  })

  it('clamps low fontSize and rounds fractional', () => {
    const r = parseConfigFile(wrap({ settings: { fontSize: 3.4 } }))
    expect(r.ok && r.data.settings!.fontSize).toBe(10)
    const r2 = parseConfigFile(wrap({ settings: { fontSize: 15.6 } }))
    expect(r2.ok && r2.data.settings!.fontSize).toBe(16)
  })

  it('rejects settings section that is not an object', () => {
    expect(parseConfigFile(wrap({ settings: 'x' }))).toEqual({ ok: false, error: '設定檔格式錯誤:settings' })
  })

  it('normalizes selectedPresetIndex to an integer >= -1', () => {
    const r1 = parseConfigFile(wrap({ settings: { selectedPresetIndex: 0.5 } }))
    expect(r1.ok && r1.data.settings!.selectedPresetIndex).toBe(-1)
    const r2 = parseConfigFile(wrap({ settings: { selectedPresetIndex: -7 } }))
    expect(r2.ok && r2.data.settings!.selectedPresetIndex).toBe(-1)
    const r3 = parseConfigFile(wrap({ settings: { selectedPresetIndex: 2 } }))
    expect(r3.ok && r3.data.settings!.selectedPresetIndex).toBe(2)
  })

  it('drops invalid snapshots, normalizes shownUnits, defaults totalCount', () => {
    const r = parseConfigFile(wrap({
      snapshots: [
        { name: ' ok ', shownUnits: ['e1'], totalCount: 5 },
        { name: '', shownUnits: 'all', totalCount: 1 },
        { name: 'noShown' },
        'junk',
        { name: 'all', shownUnits: 'all', totalCount: -3 },
      ],
    }))
    expect(r.ok).toBe(true)
    if (!r.ok)
      return
    expect(r.data.snapshots).toEqual([
      { name: 'ok', shownUnits: ['E1'], totalCount: 5 },
      { name: 'all', shownUnits: 'all', totalCount: 0 },
    ])
    expect(r.summary.snapshotCount).toBe(2)
  })

  it('rejects snapshots section that is not an array', () => {
    expect(parseConfigFile(wrap({ snapshots: {} }))).toEqual({ ok: false, error: '設定檔格式錯誤:snapshots' })
  })

  it('filters invalid player tags and keeps null-prototype map', () => {
    const r = parseConfigFile(wrap({ playerTags: { a: 'enemy', b: 'Bogus Tag', __proto__x: 1, constructor: 'selfish' } }))
    expect(r.ok).toBe(true)
    if (!r.ok)
      return
    expect(Object.getPrototypeOf(r.data.playerTags)).toBeNull()
    expect({ ...r.data.playerTags }).toEqual({ a: 'enemy', constructor: 'selfish' })
  })

  it('rejects playerTags section that is not a plain object', () => {
    expect(parseConfigFile(wrap({ playerTags: [] }))).toEqual({ ok: false, error: '設定檔格式錯誤:playerTags' })
  })

  it('preserves a literal __proto__ key from JSON text as an own enumerable prop', () => {
    // Built from a string literal, not JSON.stringify of an object literal —
    // `{ __proto__: 'enemy' }` would set the prototype instead of an own key,
    // so JSON.stringify of that object would drop it entirely.
    const text = '{"format":"ra2web-assistant-config","version":1,"exportedAt":"x",'
      + '"data":{"playerTags":{"__proto__":"enemy","a":"reliable"}}}'
    const r = parseConfigFile(text)
    expect(r.ok).toBe(true)
    if (!r.ok)
      return
    expect(Object.getPrototypeOf(r.data.playerTags)).toBeNull()
    expect(Object.keys(r.data.playerTags!).sort()).toEqual(['__proto__', 'a'])
    expect(Object.getOwnPropertyDescriptor(r.data.playerTags, '__proto__')?.value).toBe('enemy')
  })
})

describe('configFileName', () => {
  it('uses local date + time', () => {
    const d = new Date(2026, 8, 7, 4, 5) // local 2026-09-07 04:05
    expect(configFileName(d)).toBe('ra2web-assistant-config-20260907-0405.json')
  })
})
