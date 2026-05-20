import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ActiveFilterInfo from '../ActiveFilterInfo.vue'

describe('activeFilterInfo', () => {
  it('shows idle text when applied is null', () => {
    const w = mount(ActiveFilterInfo, { props: { applied: null } })
    expect(w.text()).toBe('尚未套用')
    expect(w.classes()).toContain('idle')
  })

  it('shows preset with "all" sentinel as 全部 / total', () => {
    const w = mount(ActiveFilterInfo, {
      props: {
        applied: {
          mode: 'preset' as const,
          shownUnits: 'all' as const,
          total: 131,
          snapshotName: '我的快照',
        },
      },
    })
    expect(w.text()).toBe('套用中：快照 — 我的快照（全部 / 131）')
    expect(w.classes()).toContain('preset')
  })

  it('shows preset with explicit array count', () => {
    const w = mount(ActiveFilterInfo, {
      props: {
        applied: {
          mode: 'preset' as const,
          shownUnits: ['E1', 'DOG'],
          total: 131,
          snapshotName: '我的快照',
        },
      },
    })
    expect(w.text()).toBe('套用中：快照 — 我的快照（2 / 131）')
  })

  it('shows custom + "all" as 全部顯示', () => {
    const w = mount(ActiveFilterInfo, {
      props: {
        applied: {
          mode: 'custom' as const,
          shownUnits: 'all' as const,
          total: 131,
        },
      },
    })
    expect(w.text()).toBe('套用中：單場自訂 — 全部顯示')
    expect(w.classes()).toContain('custom')
  })

  it('shows custom + non-empty array as 顯示 N 個', () => {
    const w = mount(ActiveFilterInfo, {
      props: {
        applied: {
          mode: 'custom' as const,
          shownUnits: ['E1', 'DOG'],
          total: 131,
        },
      },
    })
    expect(w.text()).toBe('套用中：單場自訂 — 顯示 2 個')
    expect(w.classes()).toContain('has-hidden')
  })

  it('shows custom + empty array as 全部隱藏', () => {
    const w = mount(ActiveFilterInfo, {
      props: {
        applied: {
          mode: 'custom' as const,
          shownUnits: [],
          total: 131,
        },
      },
    })
    expect(w.text()).toBe('套用中：單場自訂 — 全部隱藏')
    expect(w.classes()).toContain('has-hidden')
  })
})
