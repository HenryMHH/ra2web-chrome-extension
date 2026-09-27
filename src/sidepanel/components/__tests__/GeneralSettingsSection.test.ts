import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// PlayerTagSection is stubbed below, but its module graph (composable → store) still evaluates
// the webextension-polyfill import, which requires an extension-looking `chrome` global.
const browserMock = {
  runtime: { id: 'test' },
  storage: { local: { get: vi.fn(async () => ({})), set: vi.fn() }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
}
;(globalThis as any).browser = browserMock
;(globalThis as any).chrome = browserMock

const GeneralSettingsSection = (await import('../GeneralSettingsSection.vue')).default

function mountIt() {
  return mount(GeneralSettingsSection, {
    props: { pending: null },
    global: { stubs: { PlayerTagSection: { template: '<div data-testid="ptag-section" />' } } },
  })
}

async function open(w: ReturnType<typeof mountIt>) {
  await w.findAll('button').find(b => b.text().includes('一般設定'))!.trigger('click')
}

describe('generalSettingsSection', () => {
  it('is titled 一般設定 and collapsed by default', () => {
    const w = mountIt()
    expect(w.text()).toContain('一般設定')
    expect(w.find('[data-testid="ptag-section"]').exists()).toBe(false)
    expect(w.find('[data-testid="config-export"]').exists()).toBe(false)
  })

  it('opens to show 玩家標籤 first, then 設定檔', async () => {
    const w = mountIt()
    await open(w)
    const html = w.html()
    expect(html.indexOf('data-testid="ptag-section"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-testid="ptag-section"')).toBeLessThan(html.indexOf('data-testid="config-export"'))
  })

  it('forwards config row events', async () => {
    const w = mountIt()
    await open(w)
    await w.find('[data-testid="config-export"]').trigger('click')
    expect(w.emitted('export')).toHaveLength(1)
  })
})
