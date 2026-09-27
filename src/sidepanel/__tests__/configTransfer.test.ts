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

async function openGeneral(w: ReturnType<typeof mount>) {
  await w.findAll('button').find(b => b.text().includes('一般設定'))!.trigger('click')
  await flush()
}

async function mountPanel({ general = true }: { general?: boolean } = {}) {
  const Sidepanel = (await import('../Sidepanel.vue')).default
  const w = mount(Sidepanel)
  await flush()
  if (general)
    await openGeneral(w)
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
  it('puts 玩家標籤 and 設定檔 in a collapsed 一般設定 accordion after the per-game sections', async () => {
    const w = await mountPanel({ general: false })
    expect(w.text()).toContain('一般設定')
    expect(w.find('[data-testid="config-export"]').exists()).toBe(false)
    expect(w.find('[data-testid="ptag-section"]').exists()).toBe(false)
    await openGeneral(w)
    const html = w.html()
    expect(html.indexOf('data-testid="general-settings"')).toBeGreaterThan(html.indexOf('data-testid="display-toggle"'))
    expect(html.indexOf('data-testid="general-settings"')).toBeGreaterThan(html.indexOf('單位篩選'))
    expect(html.indexOf('data-testid="ptag-section"')).toBeLessThan(html.indexOf('data-testid="config-export"'))
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
    browserMock.storage.local.set.mockClear()
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

    // The import write itself (first storage.local.set call, from
    // writeConfigToStorage) must already carry the clamped index — not just
    // the later reload/save — so a storage.onChanged echo of that write is
    // JSON-identical to settings.value and the useRa2Settings listener no-ops
    // instead of reverting the clamp and firing a spurious extra apply.
    const firstSetCall = browserMock.storage.local.set.mock.calls[0][0] as Record<string, any>
    expect(firstSetCall.ra2NamesSettings.selectedPresetIndex).toBe(-1)
    w.unmount()
  })

  it('invalid file shows error toast and no pending box', async () => {
    const w = await mountPanel()
    await pickFile(w, '{bad json')
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    expect(w.text()).toContain('檔案不是有效的 JSON')
    w.unmount()
  })

  it('rejects an oversized file before reading it, without showing a pending box', async () => {
    const w = await mountPanel()
    const input = w.find('[data-testid="config-file-input"]')
    const file = new File(['{}'], 'big.json')
    Object.defineProperty(file, 'size', { value: 1_000_001 })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flush()
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    expect(w.text()).toContain('檔案過大(上限 1 MB)')
    w.unmount()
  })

  it('import success is not blocked on apply reaching a (possibly unreachable) game tab', async () => {
    const w = await mountPanel()
    apply.mockImplementationOnce(() => new Promise(() => {})) // never resolves — no game tab
    await pickFile(w, { format: 'ra2web-assistant-config', version: 1, data: { playerTags: { bob: 'newbie' } } })
    await w.find('[data-testid="config-confirm"]').trigger('click')
    await flush()
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(false)
    expect(w.find('[data-testid="config-export"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-testid="config-import"]').attributes('disabled')).toBeUndefined()
    expect(w.text()).toContain('已匯入設定檔')
    w.unmount()
  })

  it('confirm shows an error and keeps the pending box when the storage write fails', async () => {
    const w = await mountPanel()
    await pickFile(w, { format: 'ra2web-assistant-config', version: 1, data: { playerTags: { bob: 'newbie' } } })
    browserMock.storage.local.set.mockRejectedValueOnce(new Error('disk full'))
    await w.find('[data-testid="config-confirm"]').trigger('click')
    await flush()
    expect(w.text()).toContain('匯入失敗')
    expect(w.find('[data-testid="config-pending"]').exists()).toBe(true)
    expect(w.find('[data-testid="config-confirm"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('exports custom player tag defs', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    const w = await mountPanel()
    await w.find('[data-testid="config-export"]').trigger('click')
    await flush()
    const parsed = JSON.parse((download.mock.calls[0] as [string, string])[1])
    expect(parsed.version).toBe(1)
    expect(parsed.data.customPlayerTags).toEqual([{ id: 'camper', label: '蹲家', bg: '#9333ea' }])
    w.unmount()
  })

  it('importing custom tags writes them and refreshes the 玩家標籤 list', async () => {
    const w = await mountPanel()
    expect(w.findAll('[data-testid="ptag-custom-row"]')).toHaveLength(0)
    await pickFile(w, {
      format: 'ra2web-assistant-config',
      version: 1,
      data: { customPlayerTags: [{ id: 'camper', label: '蹲家', bg: '#9333ea' }], playerTags: { bob: 'camper' } },
    })
    expect(w.find('[data-testid="config-pending"]').text()).toContain('1 個自訂標籤')
    await w.find('[data-testid="config-confirm"]').trigger('click')
    await flush()
    expect(mem.ra2CustomPlayerTags).toEqual([{ id: 'camper', label: '蹲家', bg: '#9333ea' }])
    expect(mem.ra2PlayerTags).toEqual({ bob: 'camper' })
    expect(w.findAll('[data-testid="ptag-custom-row"]')).toHaveLength(1)
    w.unmount()
  })
})
