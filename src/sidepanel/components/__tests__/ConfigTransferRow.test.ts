import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ConfigTransferRow from '../ConfigTransferRow.vue'

describe('configTransferRow', () => {
  it('renders title and both buttons', () => {
    const w = mount(ConfigTransferRow, { props: { pending: null } })
    expect(w.text()).toContain('設定檔')
    expect(w.find('[data-testid="config-export"]').text()).toContain('匯出')
    expect(w.find('[data-testid="config-import"]').text()).toContain('匯入')
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
  })

  it('emits export on export click', async () => {
    const w = mount(ConfigTransferRow, { props: { pending: null } })
    await w.find('[data-testid="config-export"]').trigger('click')
    expect(w.emitted('export')).toHaveLength(1)
  })

  it('import click opens the hidden file input', async () => {
    const w = mount(ConfigTransferRow, { props: { pending: null }, attachTo: document.body })
    const input = w.find('[data-testid="config-file-input"]').element as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    await w.find('[data-testid="config-import"]').trigger('click')
    expect(click).toHaveBeenCalled()
    w.unmount()
  })

  it('emits pick with the chosen file and resets the input', async () => {
    const w = mount(ConfigTransferRow, { props: { pending: null } })
    const input = w.find('[data-testid="config-file-input"]')
    const file = new File(['{}'], 'c.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(w.emitted('pick')![0]).toEqual([file])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('shows pending summary with only present sections', () => {
    const w = mount(ConfigTransferRow, {
      props: { pending: { settings: true, snapshotCount: 3, playerTagCount: null } },
    })
    const p = w.find('[data-testid="config-pending"]')
    expect(p.text()).toContain('設定')
    expect(p.text()).toContain('3 個快照')
    expect(p.text()).not.toContain('玩家標記')
  })

  it('emits confirm / cancel from pending box', async () => {
    const w = mount(ConfigTransferRow, {
      props: { pending: { settings: false, snapshotCount: null, playerTagCount: 2 } },
    })
    expect(w.find('[data-testid="config-pending"]').text()).toContain('2 個玩家標記')
    await w.find('[data-testid="config-confirm"]').trigger('click')
    await w.find('[data-testid="config-cancel"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('disables all buttons while busy', () => {
    const w = mount(ConfigTransferRow, {
      props: { pending: { settings: true, snapshotCount: 0, playerTagCount: 0 }, busy: true },
    })
    for (const id of ['config-export', 'config-import', 'config-confirm', 'config-cancel'])
      expect(w.find(`[data-testid="${id}"]`).attributes('disabled')).toBeDefined()
  })

  it('disables import/export buttons while a pending import awaits confirmation', () => {
    const w = mount(ConfigTransferRow, {
      props: { pending: { settings: true, snapshotCount: null, playerTagCount: null } },
    })
    expect(w.find('[data-testid="config-export"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="config-import"]').attributes('disabled')).toBeDefined()
  })
})
