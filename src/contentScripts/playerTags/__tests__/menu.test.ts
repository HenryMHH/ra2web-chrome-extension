import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENU_CLASS, closeTagMenu, isTagMenuOpen, openTagMenu, swallowEvents } from '../menu'
import { STYLE_ID, ensureStyles } from '../styles'

let button: HTMLButtonElement

beforeEach(() => {
  document.body.innerHTML = '<div id="game"><button id="b">+</button></div>'
  button = document.getElementById('b') as HTMLButtonElement
})

afterEach(() => closeTagMenu())

function menuItems() {
  return Array.from(document.querySelectorAll(`.${MENU_CLASS} [data-tag]`)) as HTMLElement[]
}

describe('ensureStyles', () => {
  it('injects a single style element', () => {
    ensureStyles()
    ensureStyles()
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1)
  })
})

describe('openTagMenu', () => {
  it('renders the four tags on document.body', () => {
    openTagMenu(button, () => {})
    expect(isTagMenuOpen()).toBe(true)
    const menu = document.querySelector(`.${MENU_CLASS}`)!
    expect(menu.parentElement).toBe(document.body)
    expect(menuItems().map(i => i.textContent)).toEqual(['可靠', '敵人', '自私', '新手'])
  })

  it('clicking an item calls onPick and closes', () => {
    const onPick = vi.fn()
    openTagMenu(button, onPick)
    menuItems()[2].click()
    expect(onPick).toHaveBeenCalledWith('selfish')
    expect(isTagMenuOpen()).toBe(false)
  })

  it('opening again from the same button toggles it closed', () => {
    openTagMenu(button, () => {})
    openTagMenu(button, () => {})
    expect(isTagMenuOpen()).toBe(false)
  })

  it('opening from another button replaces the menu', () => {
    const other = document.createElement('button')
    document.body.appendChild(other)
    openTagMenu(button, () => {})
    openTagMenu(other, () => {})
    expect(document.querySelectorAll(`.${MENU_CLASS}`)).toHaveLength(1)
    expect(isTagMenuOpen()).toBe(true)
  })

  it('mousedown outside closes; mousedown inside does not', () => {
    openTagMenu(button, () => {})
    menuItems()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(isTagMenuOpen()).toBe(true)
    document.getElementById('game')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(isTagMenuOpen()).toBe(false)
  })

  it('escape closes', () => {
    openTagMenu(button, () => {})
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(isTagMenuOpen()).toBe(false)
  })

  it('escape stops propagation and prevents default so the game (e.g. diplomacy screen) does not also react to it', () => {
    openTagMenu(button, () => {})
    const windowHandler = vi.fn()
    window.addEventListener('keydown', windowHandler)
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(isTagMenuOpen()).toBe(false)
    expect(ev.defaultPrevented).toBe(true)
    expect(windowHandler).not.toHaveBeenCalled()
    window.removeEventListener('keydown', windowHandler)
  })

  it('a non-Escape key does not stop propagation', () => {
    openTagMenu(button, () => {})
    const windowHandler = vi.fn()
    window.addEventListener('keydown', windowHandler)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(windowHandler).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', windowHandler)
    closeTagMenu()
  })

  it('menu clicks do not reach the game', () => {
    const gameClick = vi.fn()
    document.body.addEventListener('click', gameClick)
    openTagMenu(button, () => {})
    menuItems()[0].click()
    expect(gameClick).not.toHaveBeenCalled()
    document.body.removeEventListener('click', gameClick)
  })

  it('renders the given tag list (builtins + custom) when provided', async () => {
    const { allPlayerTags } = await import('~/constants/playerTags')
    const onPick = vi.fn()
    openTagMenu(button, onPick, allPlayerTags([{ id: 'camper', label: '蹲家', bg: '#9333ea' }]))
    expect(menuItems().map(i => i.textContent)).toEqual(['可靠', '敵人', '自私', '新手', '蹲家'])
    menuItems()[4].click()
    expect(onPick).toHaveBeenCalledWith('camper')
  })
})

describe('swallowEvents', () => {
  it('stops mouse events from bubbling', () => {
    const parentClick = vi.fn()
    document.getElementById('game')!.addEventListener('mousedown', parentClick)
    swallowEvents(button)
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(parentClick).not.toHaveBeenCalled()
  })
})
