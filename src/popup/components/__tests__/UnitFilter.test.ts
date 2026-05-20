import { describe, expect, it, vi } from 'vitest'
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

function mountFilter() {
  return mount(UnitFilter, {
    props: {
      hiddenUnitsCustom: [],
      filterMode: 'custom' as const,
      selectedPresetIndex: -1,
    },
  })
}

describe('unitFilter', () => {
  it('fetches units on mount', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockResolvedValue({ units: [['E1', '大兵']], source: 'rules' })
    mountFilter()
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(1)
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
    await w.get('details').trigger('toggle')
    await flushPromises()
    expect(getUnitNames).toHaveBeenCalledTimes(2)
  })

  it('survives fetch rejection without throwing', async () => {
    getUnitNames.mockReset()
    getUnitNames.mockRejectedValueOnce(new Error('boom'))
    expect(() => mountFilter()).not.toThrow()
    await flushPromises()
  })
})
