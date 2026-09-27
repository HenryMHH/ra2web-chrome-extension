import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Multi-key-capable get (store.deleteCustomTag issues two single-key gets; keep both shapes).
// No onChanged firing needed: the component updates its ref from each store call's return value.
const mem: Record<string, any> = {}
function getKeys(keys: string | string[]) {
  const list = Array.isArray(keys) ? keys : [keys]
  return Object.fromEntries(list.filter(k => k in mem).map(k => [k, JSON.parse(JSON.stringify(mem[k]))]))
}
const browserMock = {
  runtime: { id: 'test' },
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => getKeys(keys)),
      set: vi.fn(async (obj: Record<string, any>) => Object.assign(mem, JSON.parse(JSON.stringify(obj)))),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}
;(globalThis as any).browser = browserMock
;(globalThis as any).chrome = browserMock

const flush = () => new Promise(r => setTimeout(r, 30))

async function mountSection() {
  const PlayerTagSection = (await import('../PlayerTagSection.vue')).default
  const w = mount(PlayerTagSection)
  await flush()
  return w
}

async function fillAndSubmit(w: ReturnType<typeof mount>, id: string, label: string) {
  await w.find('[data-testid="ptag-id-input"]').setValue(id)
  await w.find('[data-testid="ptag-label-input"]').setValue(label)
  await w.find('[data-testid="ptag-form"]').trigger('submit')
  await flush()
}

beforeEach(() => {
  Object.keys(mem).forEach(k => delete mem[k])
})

describe('playerTagSection', () => {
  it('shows the title and the four builtin tags without edit/delete controls', async () => {
    const w = await mountSection()
    expect(w.text()).toContain('玩家標籤')
    expect(w.findAll('[data-testid="ptag-builtin"]').map(b => b.text())).toEqual(['可靠', '敵人', '自私', '新手'])
    expect(w.findAll('[data-testid="ptag-custom-row"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="ptag-edit"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="ptag-delete"]')).toHaveLength(0)
  })

  it('adds a custom tag with a palette colour, then resets the form', async () => {
    const w = await mountSection()
    await w.find('[data-testid="ptag-swatch"][data-color="#9333ea"]').trigger('click')
    await fillAndSubmit(w, 'camper', '蹲家')
    expect(mem.ra2CustomPlayerTags).toEqual([{ id: 'camper', label: '蹲家', bg: '#9333ea' }])
    const rows = w.findAll('[data-testid="ptag-custom-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('蹲家')
    expect(rows[0].text()).toContain('camper')
    expect((w.find('[data-testid="ptag-id-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('uses the native colour picker value and shows it in the preview', async () => {
    const w = await mountSection()
    await w.find('[data-testid="ptag-color-input"]').setValue('#123456')
    await w.find('[data-testid="ptag-label-input"]').setValue('預')
    const preview = w.find('[data-testid="ptag-preview"]')
    expect(preview.text()).toBe('預')
    expect((preview.element as HTMLElement).style.background).toContain('rgb(18, 52, 86)')
  })

  it('shows a validation error and writes nothing for a builtin / duplicate / malformed id', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    const w = await mountSection()
    browserMock.storage.local.set.mockClear()
    await fillAndSubmit(w, 'enemy', '敵')
    expect(w.find('[data-testid="ptag-error"]').text()).toBe('此 ID 為內建標籤,不可使用')
    await fillAndSubmit(w, 'camper', '又一個')
    expect(w.find('[data-testid="ptag-error"]').text()).toBe('此 ID 已存在')
    await fillAndSubmit(w, 'Bad Id', 'x')
    expect(w.find('[data-testid="ptag-error"]').text()).toContain('ID 只能使用')
    expect(browserMock.storage.local.set).not.toHaveBeenCalled()
  })

  it('edit keeps the id locked and updates label/colour in place', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    const w = await mountSection()
    await w.find('[data-testid="ptag-edit"]').trigger('click')
    const idInput = w.find('[data-testid="ptag-id-input"]')
    expect((idInput.element as HTMLInputElement).value).toBe('camper')
    expect(idInput.attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="ptag-submit"]').text()).toBe('儲存')
    await w.find('[data-testid="ptag-label-input"]').setValue('龜')
    await w.find('[data-testid="ptag-form"]').trigger('submit')
    await flush()
    expect(mem.ra2CustomPlayerTags).toEqual([{ id: 'camper', label: '龜', bg: '#9333ea' }])
    expect(w.find('[data-testid="ptag-submit"]').text()).toBe('新增')
  })

  it('cancel edit returns to add mode without writing', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    const w = await mountSection()
    await w.find('[data-testid="ptag-edit"]').trigger('click')
    browserMock.storage.local.set.mockClear()
    await w.find('[data-testid="ptag-cancel-edit"]').trigger('click')
    expect(w.find('[data-testid="ptag-submit"]').text()).toBe('新增')
    expect((w.find('[data-testid="ptag-id-input"]').element as HTMLInputElement).value).toBe('')
    expect(browserMock.storage.local.set).not.toHaveBeenCalled()
  })

  it('delete asks for confirmation with the affected player count, then cascades', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    mem.ra2PlayerTags = { alice: 'camper', bob: 'enemy' }
    const w = await mountSection()
    await w.find('[data-testid="ptag-delete"]').trigger('click')
    await flush()
    const pending = w.find('[data-testid="ptag-remove-pending"]')
    expect(pending.text()).toContain('蹲家')
    expect(pending.text()).toContain('1 位玩家')
    await w.find('[data-testid="ptag-remove-confirm"]').trigger('click')
    await flush()
    expect(mem.ra2CustomPlayerTags).toEqual([])
    expect(mem.ra2PlayerTags).toEqual({ bob: 'enemy' })
    expect(w.findAll('[data-testid="ptag-custom-row"]')).toHaveLength(0)
    expect(w.find('[data-testid="ptag-remove-pending"]').exists()).toBe(false)
  })

  it('delete cancel keeps the tag', async () => {
    mem.ra2CustomPlayerTags = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    const w = await mountSection()
    await w.find('[data-testid="ptag-delete"]').trigger('click')
    await flush()
    expect(w.find('[data-testid="ptag-remove-pending"]').text()).not.toContain('位玩家')
    await w.find('[data-testid="ptag-remove-cancel"]').trigger('click')
    expect(w.find('[data-testid="ptag-remove-pending"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="ptag-custom-row"]')).toHaveLength(1)
  })
})
