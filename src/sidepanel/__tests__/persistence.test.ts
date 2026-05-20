import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mem: Record<string, any> = {}
const browserMock = {
  runtime: { id: 'test', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mem ? { [key]: mem[key] } : {})),
      set: vi.fn(async (obj: Record<string, any>) => Object.assign(mem, obj)),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    query: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
}

;(globalThis as any).chrome = {
  ...browserMock,
  storage: {
    local: {
      get: (key: string, cb?: any) => {
        const r = key in mem ? { [key]: mem[key] } : {}
        if (cb) {
          cb(r)
          return undefined
        }
        return Promise.resolve(r)
      },
      set: (obj: Record<string, any>, cb?: any) => {
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

;(globalThis as any).browser = browserMock

vi.mock('~/composables/useRa2Bridge', () => ({
  useRa2Bridge: () => ({
    apply: vi.fn().mockResolvedValue({ ok: true }),
    status: vi.fn().mockResolvedValue({ injected: true, enabled: false }),
    getUnitNames: vi.fn().mockResolvedValue({ units: [['E1', 'GI'], ['DOG', 'Attack Dog']], source: 'test' }),
  }),
}))

beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k])
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('sidepanel persistence', () => {
  it('snapshots saved in one mount survive a remount', async () => {
    const Sidepanel = (await import('../Sidepanel.vue')).default

    // First mount: seed storage with a snapshot via composable directly
    const { useRa2Snapshots } = await import('~/composables/useRa2Snapshots')
    const s = useRa2Snapshots()
    await s.load()
    await s.add({ name: 'snap1', shownUnits: ['E1'], totalCount: 2 })

    // Also seed settings to filterMode=preset, selectedPresetIndex=0
    const { useRa2Settings } = await import('~/composables/useRa2Settings')
    const a = useRa2Settings()
    await a.load()
    a.settings.value.filterMode = 'preset'
    a.settings.value.selectedPresetIndex = 0
    await a.save()

    // Mount sidepanel
    const w = mount(Sidepanel)
    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    // The select should have 1 snapshot option (besides the placeholder)
    const opts = w.findAll('option')
    expect(opts.length).toBeGreaterThanOrEqual(2)
    const names = opts.map(o => o.text())
    expect(names.some(n => n.includes('snap1'))).toBe(true)

    w.unmount()

    // Re-mount fresh
    const w2 = mount(Sidepanel)
    await new Promise(r => setTimeout(r, 50))
    await w2.vm.$nextTick()
    const opts2 = w2.findAll('option')
    const names2 = opts2.map(o => o.text())
    expect(names2.some(n => n.includes('snap1'))).toBe(true)
  })
})
