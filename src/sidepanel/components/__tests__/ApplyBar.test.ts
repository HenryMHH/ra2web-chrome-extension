import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ApplyBar from '../ApplyBar.vue'

describe('applyBar', () => {
  it('shows the label when success is false', () => {
    const w = mount(ApplyBar, { props: { label: '套用單位篩選' } })
    expect(w.text()).toContain('套用單位篩選')
    expect(w.find('.success-checkmark').exists()).toBe(false)
  })

  it('replaces the label with CheckAnimation when success is true', () => {
    const w = mount(ApplyBar, { props: { label: '套用單位篩選', success: true } })
    expect(w.text()).not.toContain('套用單位篩選')
    expect(w.find('.success-checkmark').exists()).toBe(true)
  })

  it('no longer renders a hint paragraph', () => {
    const w = mount(ApplyBar, { props: { label: 'x' } })
    expect(w.find('p').exists()).toBe(false)
  })

  it('emits apply on click', async () => {
    const w = mount(ApplyBar, { props: { label: 'x' } })
    await w.find('button').trigger('click')
    expect(w.emitted('apply')).toBeTruthy()
  })

  it('button is disabled when disabled=true', () => {
    const w = mount(ApplyBar, { props: { label: 'x', disabled: true } })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('button is disabled when success=true', () => {
    const w = mount(ApplyBar, { props: { label: 'x', success: true } })
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('does not dim the button when success=true', () => {
    const w = mount(ApplyBar, { props: { label: 'x', success: true } })
    const cls = w.find('button').classes()
    expect(cls).not.toContain('opacity-50')
  })

  it('dims the button when disabled=true and success=false', () => {
    const w = mount(ApplyBar, { props: { label: 'x', disabled: true } })
    const cls = w.find('button').classes()
    expect(cls).toContain('opacity-50')
  })
})
