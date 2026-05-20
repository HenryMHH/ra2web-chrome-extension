import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mem: Record<string, any> = {}
const setCalls: any[] = []
const onChangedListeners: Array<(c: any, a: string) => void> = []

;(globalThis as any).chrome = {
  runtime: { id: 'test', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: {
    local: {
      get: (key: string, cb?: any) => {
        // structured-clone-ish: deep clone to mimic chrome's serialization
        const raw = key in mem ? mem[key] : undefined
        const r = raw === undefined ? {} : { [key]: structuredClone(raw) }
        if (cb) {
          cb(r)
          return undefined
        }
        return Promise.resolve(r)
      },
      set: (obj: Record<string, any>, cb?: any) => {
        setCalls.push(obj)
        // structured-clone-ish: mimic real Chrome's serialization
        for (const [k, v] of Object.entries(obj))
          mem[k] = structuredClone(v)
        // fire onChanged
        const changes: Record<string, any> = {}
        for (const [k, v] of Object.entries(obj))
          changes[k] = { newValue: structuredClone(v) }
        Promise.resolve().then(() => {
          for (const l of onChangedListeners)
            l(changes, 'local')
        })
        if (cb) {
          cb()
          return undefined
        }
        return Promise.resolve()
      },
    },
    onChanged: {
      addListener: (l: any) => onChangedListeners.push(l),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    query: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
}

vi.mock('~/composables/useRa2Bridge', () => ({
  useRa2Bridge: () => ({
    apply: vi.fn().mockResolvedValue({ ok: true }),
    status: vi.fn().mockResolvedValue({ injected: true, enabled: false }),
    getUnitNames: vi.fn().mockResolvedValue({ units: [['E1', 'GI'], ['DOG', 'Attack Dog']], source: 'test' }),
  }),
}))

beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k])
  setCalls.length = 0
  onChangedListeners.length = 0
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('save snapshot via UI', () => {
  it('clicking 儲存快照 button writes snapshot to storage and updates select', async () => {
    const Sidepanel = (await import('../Sidepanel.vue')).default
    const w = mount(Sidepanel)
    // wait for init + mounted + fetchUnits
    await new Promise(r => setTimeout(r, 100))
    await w.vm.$nextTick()

    // find the save snapshot button (the one with text 儲存快照)
    const buttons = w.findAll('button')
    const saveBtn = buttons.find(b => b.text().includes('儲存快照'))
    expect(saveBtn).toBeTruthy()

    await saveBtn!.trigger('click')
    // wait for async storage write and listener fire
    await new Promise(r => setTimeout(r, 50))
    await w.vm.$nextTick()

    // assert storage was written with a snapshot
    const snapshotWrites = setCalls.filter(c => 'ra2NamesSnapshots' in c)
    expect(snapshotWrites.length).toBeGreaterThan(0)
    const lastWrite = snapshotWrites[snapshotWrites.length - 1].ra2NamesSnapshots
    expect(Array.isArray(lastWrite)).toBe(true)
    expect(lastWrite.length).toBe(1)
    expect(lastWrite[0]).toHaveProperty('shownUnits')

    // assert mem has the snapshot persisted
    expect(mem.ra2NamesSnapshots).toBeDefined()
    expect(mem.ra2NamesSnapshots).toHaveLength(1)
  })
})
