import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CheckAnimation from '../CheckAnimation.vue'

describe('checkAnimation', () => {
  it('renders the success-checkmark structure', () => {
    const w = mount(CheckAnimation)
    expect(w.find('.success-checkmark').exists()).toBe(true)
    expect(w.find('.check-icon').exists()).toBe(true)
    expect(w.find('.line-tip').exists()).toBe(true)
    expect(w.find('.line-long').exists()).toBe(true)
    expect(w.find('.icon-circle').exists()).toBe(true)
    expect(w.find('.icon-fix').exists()).toBe(true)
  })
})
