import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FilterSection from '../FilterSection.vue'

vi.mock('~/popup/composables/useRa2Bridge', () => ({
  useRa2Bridge: () => ({
    getUnitNames: vi.fn().mockResolvedValue({ units: [['E1', 'GI'], ['DOG', 'Attack Dog']], source: 'test' }),
  }),
}))
vi.mock('~/popup/composables/useRa2Snapshots', () => ({
  useRa2Snapshots: () => ({
    snapshots: { value: [] },
    load: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  }),
}))

describe('filterSection', () => {
  it('renders the two tabs', () => {
    const w = mount(FilterSection, {
      props: {
        shownUnitsCustom: 'all',
        filterMode: 'custom',
        selectedPresetIndex: -1,
      },
    })
    expect(w.text()).toContain('單場自訂')
    expect(w.text()).toContain('快照')
  })

  it('emits update:filterMode when preset tab clicked', async () => {
    const w = mount(FilterSection, {
      props: {
        shownUnitsCustom: 'all',
        filterMode: 'custom',
        selectedPresetIndex: -1,
      },
    })
    const tabs = w.findAll('[role=tab]')
    if (tabs.length >= 2) {
      // reka-ui's TabsTrigger listens to mousedown.left, not click
      await tabs[1].trigger('mousedown', { button: 0 })
      expect(w.emitted('update:filterMode')).toBeTruthy()
    }
  })
})
