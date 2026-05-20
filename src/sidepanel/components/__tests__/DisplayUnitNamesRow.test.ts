import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DisplayUnitNamesRow from '../DisplayUnitNamesRow.vue'

describe('displayUnitNamesRow', () => {
  it('renders three faction chips when enabled', () => {
    const w = mount(DisplayUnitNamesRow, {
      props: {
        modelValue: true,
        ally: true,
        enemy: true,
        neutral: false,
      },
    })
    expect(w.text()).toContain('Ally')
    expect(w.text()).toContain('Enemy')
    expect(w.text()).toContain('Neutral')
  })

  it('emits update:modelValue when main toggle clicked', async () => {
    const w = mount(DisplayUnitNamesRow, {
      props: { modelValue: false, ally: true, enemy: true, neutral: true },
    })
    await w.find('[data-testid="display-toggle"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeTruthy()
  })

  it('disables faction chips when main toggle off', () => {
    const w = mount(DisplayUnitNamesRow, {
      props: { modelValue: false, ally: true, enemy: true, neutral: false },
    })
    const ally = w.find('[data-testid="faction-ally"] button[role=checkbox]')
    expect(ally.attributes('aria-disabled') === 'true' || ally.attributes('disabled') !== undefined).toBe(true)
  })
})
