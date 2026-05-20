import { describe, expect, it, vi } from 'vitest'

const mem: Record<string, any> = {}
;(globalThis as any).chrome = {
  runtime: { id: 'test' },
  storage: {
    local: {
      get: (key: string, cb?: (r: any) => void) => {
        const r = key in mem ? { [key]: mem[key] } : {}
        if (cb) {
          cb(r)
          return undefined
        }
        return Promise.resolve(r)
      },
      set: (obj: Record<string, any>, cb?: () => void) => {
        Object.assign(mem, obj)
        if (cb) {
          cb()
          return undefined
        }
        return Promise.resolve()
      },
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}

const { useRa2Snapshots } = await import('../useRa2Snapshots')
const { useRa2Settings } = await import('../useRa2Settings')

describe('useRa2Snapshots persistence', () => {
  it('round-trips snapshots through storage across composable instances', async () => {
    const a = useRa2Snapshots()
    await a.load()
    await a.add({ name: 'foo', shownUnits: 'all', totalCount: 10 })

    // Simulate sidepanel close + reopen: NEW composable instance reads from storage
    const b = useRa2Snapshots()
    await b.load()
    expect(b.snapshots.value).toHaveLength(1)
    expect(b.snapshots.value[0].name).toBe('foo')
  })
})

describe('useRa2Settings persistence', () => {
  it('round-trips shownUnitsCustom + filterMode across instances', async () => {
    const a = useRa2Settings()
    await a.load()
    a.settings.value.shownUnitsCustom = ['E1', 'DOG']
    a.settings.value.filterMode = 'preset'
    a.settings.value.selectedPresetIndex = 2
    await a.save()

    const b = useRa2Settings()
    await b.load()
    expect(b.settings.value.shownUnitsCustom).toEqual(['E1', 'DOG'])
    expect(b.settings.value.filterMode).toBe('preset')
    expect(b.settings.value.selectedPresetIndex).toBe(2)
  })
})
