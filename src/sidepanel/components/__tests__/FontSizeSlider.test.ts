import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FontSizeSlider from '../FontSizeSlider.vue'

describe('fontSizeSlider', () => {
  it('renders current value with px suffix', () => {
    const w = mount(FontSizeSlider, { props: { modelValue: 14 } })
    expect(w.text()).toMatch(/14\s*px/)
  })

  it('shows the 字體大小 label', () => {
    const w = mount(FontSizeSlider, { props: { modelValue: 14 } })
    expect(w.text()).toContain('字體大小')
  })
})
