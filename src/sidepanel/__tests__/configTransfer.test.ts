import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mem: Record<string, any> = {}
function getKeys(keys: string | string[]) {
  const list = Array.isArray(keys) ? keys : [keys]
  return Object.fromEntries(list.filter(k => k in mem).map(k => [k, mem[k]]))
}
const browserMock = {
  runtime: { id: 'test', sendMessage: vi.fn().mockResolvedValue(undefined) },
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => getKeys(keys)),
      set: vi.fn(async (obj: Record<string, any>) => Object.assign(mem, obj)),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: {
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    query: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
}
;(globalThis as any).browser = browserMock
;(globalThis as any).chrome = browserMock

const apply = vi.fn().mockResolvedValue({ ok: true })
vi.mock('~/composables/useRa2Bridge', () => ({
  useRa2Bridge: () => ({
    apply,
    status: vi.fn().mockResolvedValue({ injected: true, enabled: false }),
    getUnitNames: vi.fn().mockResolvedValue({ units: [['E1', 'GI']], source: 'test' }),
  }),
}))

const download = vi.fn()
vi.mock('~/logic/fileIO', async () => {
  const actual = await vi.importActual<typeof import('~/logic/fileIO')>('~/logic/fileIO')
  return { ...actual, downloadTextFile: (...a: unknown[]) => download(...a) }
})

async function flush() {
  await new Promise(r => setTimeout(r, 30))
}

async function mountPanel() {
  const Sidepanel = (await import('../Sidepanel.vue')).default
  const w = mount(Sidepanel)
  await flush()
  return w
}

async function pickFile(w: ReturnType<typeof mount>, content: unknown) {
  const input = w.find('[data-testid="config-file-input"]')
  const file = new File([typeof content === 'string' ? content : JSON.stringify(content)], 'c.json')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flush()
}

beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k])
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('sidepanel config export/import', () => {
  it('places the config row above the display-unit-names row', async () => {
    const w = await mountPanel()
    const html = w.html()
    expect(html.indexOf('data-testid="config-export"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-testid="config-export"')).toBeLessThan(html.indexOf('data-testid="display-toggle"'))
    w.unmount()
  })

  it('exports all three keys as a v1 config file', async () => {
    mem.ra2NamesSettings = { enabled: true, fontSize: 17 }
    mem.ra2NamesSnapshots = [{ name: 's1', shownUnits: ['E1'], totalCount: 1 }]
    mem.ra2PlayerTags = { alice: 'enemy' }
    const w = await mountPanel()
    await w.find('[data-testid="config-export"]').trigger('click')
    await flush()
    expect(download).toHaveBeenCalledTimes(1)
    const [name, text] = download.mock.calls[0] as [string, string]
    expect(name).toMatch(/^ra2web-assistant-config-\d{8}-\d{4}\.json$/)
    const parsed = JSON.parse(text)
    expect(parsed.format).toBe('ra2web-assistant-config')
    expect(parsed.version).toBe(1)
    expect(parsed.data.settings.fontSize).toBe(17)
    expect(parsed.data.snapshots).toEqual([{ name: 's1', shownUnits: ['E1'], totalCount: 1 }])
    expect(parsed.data.playerTags).toEqual({ alice: 'enemy' })
    w.unmount()
  })

  it('import shows confirmation and does not write before confirm', async () => {
    const w = await mountPanel()
    browserMock.storage.local.set.mockClear()
    await pickFile(w, { format: 'ra2web-assistant-config', version: 1, data: { playerTags: { bob: 'newbie' } } })
    expect(w.find('[data-testid="config-pending"]').text()).toContain('1 個玩家標記')
    expect(browserMock.storage.local.set).not.toHaveBeenCalled()
    await w.find('[data-testid="config-cancel"]').trigger('click')
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    expect(mem.ra2PlayerTags).toBeUndefined()
    w.unmount()
  })

  it('confirm writes storage, reloads settings, and applies once with imported filter', async () => {
    mem.ra2NamesSnapshots = [{ name: 'old', shownUnits: 'all', totalCount: 0 }]
    const w = await mountPanel()
    apply.mockClear()
    await pickFile(w, {
      format: 'ra2web-assistant-config',
      version: 1,
      data: {
        settings: { enabled: true, fontSize: 12, shownUnitsCustom: ['e1'], filterMode: 'preset', selectedPresetIndex: 5 },
        snapshots: [{ name: 'new', shownUnits: ['E1'], totalCount: 1 }],
      },
    })
    await w.find('[data-testid="config-confirm"]').trigger('click')
    await flush()

    expect(mem.ra2NamesSnapshots).toEqual([{ name: 'new', shownUnits: ['E1'], totalCount: 1 }])
    expect(mem.ra2NamesSettings.fontSize).toBe(12)
    expect(apply).toHaveBeenCalledTimes(1)
    const opts = apply.mock.calls[0][0]
    expect(opts.enabled).toBe(true)
    expect(opts.fontSize).toBe(12)
    // selectedPresetIndex 5 is out of range for 1 snapshot → clamped to -1 → custom list used
    expect(opts.shownUnits).toEqual(['E1'])
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    w.unmount()
  })

  it('invalid file shows error toast and no pending box', async () => {
    const w = await mountPanel()
    await pickFile(w, '{bad json')
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    expect(w.text()).toContain('檔案不是有效的 JSON')
    w.unmount()
  })
})
