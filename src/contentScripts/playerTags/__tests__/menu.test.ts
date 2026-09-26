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

  it('menu clicks do not reach the game', () => {
    const gameClick = vi.fn()
    document.body.addEventListener('click', gameClick)
    openTagMenu(button, () => {})
    menuItems()[0].click()
    expect(gameClick).not.toHaveBeenCalled()
    document.body.removeEventListener('click', gameClick)
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
