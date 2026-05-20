import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import UnitFilter from '../UnitFilter.vue'

const getUnitNames = vi.fn()

vi.mock('~/popup/composables/useRa2Bridge', () => ({
  useRa2Bridge: () => ({ getUnitNames }),
}))

vi.mock('~/popup/composables/useRa2Snapshots', () => ({
  useRa2Snapshots: () => ({
    snapshots: ref([]),
    load: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  }),
}))

const wrappers: any[] = []
afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
})

function mountFilter(shownUnitsCustom: 'all' | string[] = 'all') {
  const w = mount(UnitFilter, {
    props: {
      shownUnitsCustom,
      filterMode: 'custom' as const,
      selectedPresetIndex: -1,
    },
  })
  wrappers.push(w)
  return w
}

describe('unitFilter', () => {
  it('fetches units on mount', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [['E1', '大兵']], source: 'rules' })
    mountFilter()
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(1)
  })

  it('renders all checkboxes as checked when shownUnitsCustom is "all"', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter('all')
    await flushPromises()
    const boxes = w.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect((boxes[0].element as HTMLInputElement).checked).toBe(true)
    expect((boxes[1].element as HTMLInputElement).checked).toBe(true)
  })

  it('unchecking a box converts "all" → explicit array of remaining', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter('all')
    await flushPromises()
    await w.findAll('input[type="checkbox"]')[0].setValue(false)
    const emits = w.emitted('update:shownUnitsCustom')!
    expect(emits[emits.length - 1][0]).toEqual(['DOG'])
  })

  it('checking the last missing box converts explicit array back to "all"', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter(['DOG'])
    await flushPromises()
    const boxes = w.findAll('input[type="checkbox"]')
    expect((boxes[0].element as HTMLInputElement).checked).toBe(false)
    expect((boxes[1].element as HTMLInputElement).checked).toBe(true)
    await boxes[0].setValue(true)
    const emits = w.emitted('update:shownUnitsCustom')!
    expect(emits[emits.length - 1][0]).toBe('all')
  })

  it('「全部顯示」button emits "all"', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter(['DOG'])
    await flushPromises()
    await w.get('[data-testid="unit-show-all"]').trigger('click')
    const emits = w.emitted('update:shownUnitsCustom')!
    expect(emits[emits.length - 1][0]).toBe('all')
  })

  it('「全部隱藏」button emits []', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter('all')
    await flushPromises()
    await w.get('[data-testid="unit-hide-all"]').trigger('click')
    const emits = w.emitted('update:shownUnitsCustom')!
    expect(emits[emits.length - 1][0]).toEqual([])
  })

  it('refetches when document becomes visible', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [], source: 'none' })
    mountFilter()
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(2)
  })

  it('refetches when refresh button clicked', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [], source: 'none' })
    const w = mountFilter()
    await flushPromises()
    await w.get('[data-testid="unit-refresh"]').trigger('click')
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(2)
  })

  it('refetches when <details> opens', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [], source: 'none' })
    const w = mountFilter()
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(1)
    const details = w.get('details').element as HTMLDetailsElement
    details.open = true
    await new Promise(r => setTimeout(r, 0))
    expect(getUnitNames).toHaveBeenCalledTimes(2)
  })

  it('does not refetch when <details> closes', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [], source: 'none' })
    const w = mountFilter()
    await flushPromises()
    const details = w.get('details').element as HTMLDetailsElement
    details.open = true
    await new Promise(r => setTimeout(r, 0))
    const before = getUnitNames.mock.calls.length
    details.open = false
    await new Promise(r => setTimeout(r, 0))
    expect(getUnitNames.mock.calls.length).toBe(before)
  })

  it('survives fetch rejection without throwing', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockRejectedValueOnce(new Error('boom'))
    expect(() => mountFilter()).not.toThrow()
    await flushPromises()
  })

  it('renders 已勾選 count using current shownUnits', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗']],
      source: 'rules',
    })
    const w = mountFilter(['DOG'])
    await flushPromises()
    expect(w.get('[data-testid="filter-count-label"]').text()).toBe('已勾選 1 / 2')
  })

  it('emits update:totalCount when units load', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({
      units: [['E1', '大兵'], ['DOG', '狗'], ['MTNK', '犀牛']],
      source: 'rules',
    })
    const w = mountFilter('all')
    await flushPromises()
    const emits = w.emitted('update:totalCount')
    expect(emits).toBeTruthy()
    expect(emits![emits!.length - 1][0]).toBe(3)
  })
})
