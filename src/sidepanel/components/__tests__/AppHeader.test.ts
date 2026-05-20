import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppHeader from '../AppHeader.vue'

describe('appHeader', () => {
  it('renders title and version', () => {
    const w = mount(AppHeader, { props: { active: false, version: '0.0.1' } })
    expect(w.text()).toContain('Ra2 Web Assistant')
    expect(w.text()).toContain('0.0.1')
  })

  it('shows Active label when active=true', () => {
    const w = mount(AppHeader, { props: { active: true, version: '0.0.1' } })
    expect(w.text()).toContain('Active')
  })

  it('shows Inactive label when active=false', () => {
    const w = mount(AppHeader, { props: { active: false, version: '0.0.1' } })
    expect(w.text()).toContain('Inactive')
  })
})
