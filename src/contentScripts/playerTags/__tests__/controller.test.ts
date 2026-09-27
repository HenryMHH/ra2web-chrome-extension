import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal chrome.storage mock (same pattern as store.test.ts / useRa2Snapshots.test.ts).
// webextension-polyfill wraps `chrome`, so both chrome and browser must exist before the
// dynamic import below — unplugin-auto-import hoists any bare `browser` reference in this
// file into a static `import browser from 'webextension-polyfill'` that would otherwise
// evaluate before this assignment and break the mock. So this file never references bare
// `browser` — storage writes below go through the chrome mock directly.
const mem: Record<string, any> = {}
const changeListeners: Array<(changes: any, area: string) => void> = []

const storageApi = {
  local: {
    get: (key: string, cb?: (r: any) => void) => {
      const r = key in mem ? { [key]: JSON.parse(JSON.stringify(mem[key])) } : {}
      if (cb) {
        cb(r)
        return undefined
      }
      return Promise.resolve(r)
    },
    set: (obj: Record<string, any>, cb?: () => void) => {
      const changes: Record<string, any> = {}
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: mem[k], newValue: v }
        mem[k] = v
      }
      changeListeners.forEach(l => l(changes, 'local'))
      if (cb) {
        cb()
        return undefined
      }
      return Promise.resolve()
    },
  },
  onChanged: {
    addListener: (l: any) => changeListeners.push(l),
    removeListener: (l: any) => {
      const i = changeListeners.indexOf(l)
      if (i >= 0)
        changeListeners.splice(i, 1)
    },
    hasListener: vi.fn(),
  },
}

;(globalThis as any).chrome = {
  runtime: { id: 'test' },
  storage: storageApi,
}

// browser is the webextension-polyfill export that wraps chrome
;(globalThis as any).browser = {
  runtime: { id: 'test' },
  storage: storageApi,
}

const { startPlayerTags } = await import('../index')
const { CUSTOM_TAGS_KEY, PLAYER_TAGS_KEY } = await import('../store')
const { MENU_CLASS, closeTagMenu } = await import('../menu')

const DIPLO = `
<div class="diplo-form"><div class="players"><table><tbody>
  <tr><td class="player-name">henryla</td></tr>
  <tr><td class="player-name">leeqin</td></tr>
</tbody></table></div></div>`

const flush = () => new Promise(r => setTimeout(r, 0))

let ctl: ReturnType<typeof startPlayerTags>

beforeEach(() => {
  for (const k of Object.keys(mem))
    delete mem[k]
  document.body.innerHTML = DIPLO
})

afterEach(() => {
  ctl?.stop()
  closeTagMenu()
})

function btnFor(name: string) {
  const td = Array.from(document.querySelectorAll('td.player-name')).find(t => t.firstChild?.textContent?.trim() === name)!
  return td.querySelector<HTMLElement>('.ra2pt-btn')!
}

describe('startPlayerTags', () => {
  it('renders stored tags on start', async () => {
    mem[PLAYER_TAGS_KEY] = { leeqin: 'enemy' }
    ctl = startPlayerTags()
    await ctl.ready
    expect(btnFor('henryla').textContent).toBe('+')
    expect(btnFor('leeqin').textContent).toBe('-')
    expect(document.querySelector('.ra2pt-tag')!.textContent).toBe('敵人')
  })

  it('+ → pick → stored, UI shows "-" and label; "-" removes', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    btnFor('henryla').click()
    const item = document.querySelector<HTMLElement>(`.${MENU_CLASS} [data-tag="reliable"]`)!
    item.click()
    await flush()
    ctl.scanNow()
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ henryla: 'reliable' })
    expect(btnFor('henryla').textContent).toBe('-')

    btnFor('henryla').click()
    await flush()
    ctl.scanNow()
    expect(mem[PLAYER_TAGS_KEY]).toEqual({})
    expect(btnFor('henryla').textContent).toBe('+')
  })

  it('reacts to storage changes from elsewhere (other screen / tab)', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    await (globalThis as any).chrome.storage.local.set({ [PLAYER_TAGS_KEY]: { henryla: 'newbie' } })
    ctl.scanNow()
    expect(btnFor('henryla').textContent).toBe('-')
  })

  it('picks up player rows the game renders later (MutationObserver)', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    const tr = document.createElement('tr')
    tr.innerHTML = '<td class="player-name">late_joiner</td>'
    document.querySelector('tbody')!.appendChild(tr)
    await new Promise(r => setTimeout(r, 50))
    expect(btnFor('late_joiner').textContent).toBe('+')
  })

  it('re-attaches when the game rewrites a cell (widget wiped)', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    const td = document.querySelector('td.player-name')!
    td.textContent = 'henryla'
    await new Promise(r => setTimeout(r, 50))
    expect(td.querySelector('.ra2pt-btn')).not.toBeNull()
  })

  it('stop() removes widgets and stops observing', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    ctl.stop()
    expect(document.querySelector('.ra2pt-anchor')).toBeNull()
    const tr = document.createElement('tr')
    tr.innerHTML = '<td class="player-name">after_stop</td>'
    document.querySelector('tbody')!.appendChild(tr)
    await new Promise(r => setTimeout(r, 50))
    expect(document.querySelector('.ra2pt-anchor')).toBeNull()
  })

  it('a player literally named "constructor" gets a "+", and other players still render (Object.prototype must not leak in)', async () => {
    document.body.innerHTML = `
      <div class="diplo-form"><div class="players"><table><tbody>
        <tr><td class="player-name">constructor</td></tr>
        <tr><td class="player-name">henryla</td></tr>
      </tbody></table></div></div>`
    ctl = startPlayerTags()
    await ctl.ready
    expect(btnFor('constructor').textContent).toBe('+')
    expect(btnFor('henryla').textContent).toBe('+')
  })

  it('tagging a player named "constructor" works like any other name', async () => {
    document.body.innerHTML = `
      <div class="diplo-form"><div class="players"><table><tbody>
        <tr><td class="player-name">constructor</td></tr>
      </tbody></table></div></div>`
    ctl = startPlayerTags()
    await ctl.ready
    btnFor('constructor').click()
    const item = document.querySelector<HTMLElement>(`.${MENU_CLASS} [data-tag="enemy"]`)!
    item.click()
    await flush()
    ctl.scanNow()
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ constructor: 'enemy' })
    expect(btnFor('constructor').textContent).toBe('-')
  })

  it('rolls back the optimistic tag when setTag rejects, by reloading from storage', async () => {
    ctl = startPlayerTags()
    await ctl.ready
    const originalSet = storageApi.local.set
    storageApi.local.set = (_obj: any) => {
      storageApi.local.set = originalSet
      return Promise.reject(new Error('quota exceeded'))
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    btnFor('henryla').click()
    const item = document.querySelector<HTMLElement>(`.${MENU_CLASS} [data-tag="reliable"]`)!
    item.click()
    // optimistic UI shows "-" immediately, before the (about to fail) write settles
    expect(btnFor('henryla').textContent).toBe('-')

    await flush()
    await flush()
    ctl.scanNow()
    expect(mem[PLAYER_TAGS_KEY]).toBeUndefined()
    expect(btnFor('henryla').textContent).toBe('+')
    warn.mockRestore()
  })

  it('does not throw and cannot break other widgets when startPlayerTags() runs against a document with no <body>', async () => {
    const other = document.implementation.createHTMLDocument('no-body')
    other.body!.remove()
    expect(other.body).toBeNull()
    const noopCtl = startPlayerTags(other)
    await expect(noopCtl.ready).resolves.toBeUndefined()
    expect(() => noopCtl.scanNow()).not.toThrow()
    expect(() => noopCtl.stop()).not.toThrow()
  })

  it('renders stored custom tags and offers them in the dropdown', async () => {
    mem[CUSTOM_TAGS_KEY] = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    mem[PLAYER_TAGS_KEY] = { leeqin: 'camper' }
    ctl = startPlayerTags()
    await ctl.ready
    expect(btnFor('leeqin').textContent).toBe('-')
    expect(document.querySelector('.ra2pt-tag')!.textContent).toBe('蹲家')

    btnFor('henryla').click()
    document.querySelector<HTMLElement>(`.${MENU_CLASS} [data-tag="camper"]`)!.click()
    await flush()
    ctl.scanNow()
    expect(mem[PLAYER_TAGS_KEY]).toEqual({ leeqin: 'camper', henryla: 'camper' })
  })

  it('re-renders when custom tag defs change elsewhere (sidepanel edit / delete)', async () => {
    mem[CUSTOM_TAGS_KEY] = [{ id: 'camper', label: '蹲家', bg: '#9333ea' }]
    mem[PLAYER_TAGS_KEY] = { leeqin: 'camper' }
    ctl = startPlayerTags()
    await ctl.ready
    await (globalThis as any).chrome.storage.local.set({ [CUSTOM_TAGS_KEY]: [{ id: 'camper', label: '龜', bg: '#9333ea' }] })
    await new Promise(r => setTimeout(r, 50))
    expect(document.querySelector('.ra2pt-tag')!.textContent).toBe('龜')

    await (globalThis as any).chrome.storage.local.set({ [CUSTOM_TAGS_KEY]: [] })
    await new Promise(r => setTimeout(r, 50))
    expect(btnFor('leeqin').textContent).toBe('+')
  })
})
