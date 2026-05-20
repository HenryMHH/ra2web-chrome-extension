import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from '../Toast.vue'
import { useToast } from '~/composables/useToast'

const wrappers: any[] = []
beforeEach(() => {
  useToast().clear()
})
afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  useToast().clear()
})

function mountToast() {
  const w = mount(Toast)
  wrappers.push(w)
  return w
}

describe('toast', () => {
  it('renders nothing when msg is null', () => {
    const w = mountToast()
    expect(w.find('.toast').exists()).toBe(false)
  })

  it('renders text + kind class when show is called', async () => {
    const w = mountToast()
    useToast().show('ok', '已套用')
    await w.vm.$nextTick()
    const el = w.get('.toast')
    expect(el.text()).toBe('已套用')
    expect(el.classes()).toContain('ok')
  })

  it('updates kind class on re-show', async () => {
    const w = mountToast()
    useToast().show('ok', 'first')
    await w.vm.$nextTick()
    useToast().show('err', 'second')
    await w.vm.$nextTick()
    const el = w.get('.toast')
    expect(el.text()).toBe('second')
    expect(el.classes()).toContain('err')
    expect(el.classes()).not.toContain('ok')
  })
})
