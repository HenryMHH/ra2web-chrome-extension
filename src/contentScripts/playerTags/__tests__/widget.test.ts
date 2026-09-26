import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NameSlot } from '../slots'
import { ANCHOR_CLASS } from '../slots'
import { pruneWidgets, syncWidget } from '../widget'

let td: HTMLElement
const handlers = () => ({ onAdd: vi.fn(), onRemove: vi.fn() })

beforeEach(() => {
  document.body.innerHTML = '<table><tr><td class="player-name">bob</td></tr></table><div class="slot"><input class="player-name" value="me"></div>'
  td = document.querySelector('td')!
})

function inlineSlot(name = 'bob'): NameSlot {
  return { name, host: td, mode: 'inline' }
}

describe('syncWidget', () => {
  it('renders a "+" button when untagged, appended inside the host', () => {
    const a = syncWidget(inlineSlot(), undefined, handlers())
    expect(a.parentElement).toBe(td)
    expect(a.classList.contains(ANCHOR_CLASS)).toBe(true)
    expect(a.querySelector('.ra2pt-btn')!.textContent).toBe('+')
    expect(a.querySelector('.ra2pt-tag')).toBeNull()
  })

  it('renders "-" plus the tag label when tagged', () => {
    const a = syncWidget(inlineSlot(), 'enemy', handlers())
    expect(a.querySelector('.ra2pt-btn')!.textContent).toBe('-')
    const tag = a.querySelector<HTMLElement>('.ra2pt-tag')!
    expect(tag.textContent).toBe('敵人')
    expect(tag.style.background).not.toBe('')
  })

  it('is idempotent: same name+tag does not touch the DOM', () => {
    const h = handlers()
    const a1 = syncWidget(inlineSlot(), 'reliable', h)
    const inner1 = a1.firstElementChild
    const a2 = syncWidget(inlineSlot(), 'reliable', h)
    expect(a2).toBe(a1)
    expect(a2.firstElementChild).toBe(inner1)
    expect(td.querySelectorAll(`.${ANCHOR_CLASS}`)).toHaveLength(1)
  })

  it('re-renders in place when the tag changes', () => {
    const h = handlers()
    const a1 = syncWidget(inlineSlot(), undefined, h)
    const a2 = syncWidget(inlineSlot(), 'newbie', h)
    expect(a2).toBe(a1)
    expect(a2.querySelector('.ra2pt-tag')!.textContent).toBe('新手')
  })

  it('"+" click calls onAdd with name and button', () => {
    const h = handlers()
    const a = syncWidget(inlineSlot(), undefined, h)
    const btn = a.querySelector<HTMLElement>('.ra2pt-btn')!
    btn.click()
    expect(h.onAdd).toHaveBeenCalledWith('bob', btn)
    expect(h.onRemove).not.toHaveBeenCalled()
  })

  it('"-" click calls onRemove', () => {
    const h = handlers()
    const a = syncWidget(inlineSlot(), 'selfish', h)
    a.querySelector<HTMLElement>('.ra2pt-btn')!.click()
    expect(h.onRemove).toHaveBeenCalledWith('bob')
  })

  it('clicks do not bubble to the game', () => {
    const rowClick = vi.fn()
    td.parentElement!.addEventListener('click', rowClick)
    const a = syncWidget(inlineSlot(), undefined, handlers())
    a.querySelector<HTMLElement>('.ra2pt-btn')!.click()
    expect(rowClick).not.toHaveBeenCalled()
  })

  it('after-input mode inserts the anchor as the next sibling of the input', () => {
    const input = document.querySelector('input')!
    const a = syncWidget({ name: 'me', host: input, mode: 'after-input' }, undefined, handlers())
    expect(input.nextElementSibling).toBe(a)
    expect(a.dataset.mode).toBe('after-input')
    const again = syncWidget({ name: 'me', host: input, mode: 'after-input' }, undefined, handlers())
    expect(again).toBe(a)
  })

  it('handlers are read at click time (latest handlers win)', () => {
    const h1 = handlers()
    const h2 = handlers()
    const a = syncWidget(inlineSlot(), undefined, h1)
    syncWidget(inlineSlot(), undefined, h2)
    a.querySelector<HTMLElement>('.ra2pt-btn')!.click()
    expect(h1.onAdd).not.toHaveBeenCalled()
    expect(h2.onAdd).toHaveBeenCalled()
  })
})

describe('pruneWidgets', () => {
  it('removes anchors not in keep', () => {
    const a = syncWidget(inlineSlot(), undefined, handlers())
    const input = document.querySelector('input')!
    const b = syncWidget({ name: 'me', host: input, mode: 'after-input' }, undefined, handlers())
    pruneWidgets(document, new Set([b]))
    expect(a.isConnected).toBe(false)
    expect(b.isConnected).toBe(true)
  })
})
