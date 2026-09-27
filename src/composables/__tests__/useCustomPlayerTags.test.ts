import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same mock shape as contentScripts/playerTags/__tests__/store.test.ts (single-key get, set fires
// onChanged). Never reference bare `browser` here — see controller.test.ts header comment.
const mem: Record<string, any> = {}
const changeListeners: Array<(changes: any, area: string) => void> = []
const storageApi = {
  local: {
    get: (key: string) => Promise.resolve(key in mem ? { [key]: JSON.parse(JSON.stringify(mem[key])) } : {}),
    set: (obj: Record<string, any>) => {
      const changes: Record<string, any> = {}
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: mem[k], newValue: v }
        mem[k] = v
      }
      changeListeners.forEach(l => l(changes, 'local'))
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
;(globalThis as any).chrome = { runtime: { id: 'test' }, storage: storageApi }
;(globalThis as any).browser = { runtime: { id: 'test' }, storage: storageApi }

const { useCustomPlayerTags } = await import('../useCustomPlayerTags')

const camper = { id: 'camper', label: '蹲家', bg: '#9333ea' }

beforeEach(async () => {
  for (const k of Object.keys(mem))
    delete mem[k]
  await useCustomPlayerTags().load()
})

describe('useCustomPlayerTags', () => {
  it('load reads storage into the shared ref', async () => {
    mem.ra2CustomPlayerTags = [camper]
    const { customTags, load } = useCustomPlayerTags()
    await load()
    expect(customTags.value).toEqual([camper])
  })

  it('upsert adds then updates in place', async () => {
    const { customTags, upsert } = useCustomPlayerTags()
    await upsert(camper)
    await upsert({ ...camper, label: '龜' })
    expect(customTags.value).toEqual([{ ...camper, label: '龜' }])
    expect(mem.ra2CustomPlayerTags).toEqual([{ ...camper, label: '龜' }])
  })

  it('remove deletes the def, cascades assignments and returns the removed count', async () => {
    mem.ra2CustomPlayerTags = [camper]
    mem.ra2PlayerTags = { a: 'camper', b: 'enemy' }
    const { customTags, load, remove, countAssignments } = useCustomPlayerTags()
    await load()
    expect(await countAssignments('camper')).toBe(1)
    expect(await remove('camper')).toBe(1)
    expect(customTags.value).toEqual([])
    expect({ ...mem.ra2PlayerTags }).toEqual({ b: 'enemy' })
  })

  it('follows external writes via storage.onChanged', async () => {
    const { customTags } = useCustomPlayerTags()
    await storageApi.local.set({ ra2CustomPlayerTags: [camper] })
    expect(customTags.value).toEqual([camper])
  })
})
