import type { PlayerTagId } from '~/constants/playerTags'
import { PLAYER_TAGS } from '~/constants/playerTags'

export const MENU_CLASS = 'ra2pt-menu'

export const GUARDED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'] as const

export function swallowEvents(el: HTMLElement): void {
  for (const type of GUARDED_EVENTS)
    el.addEventListener(type, e => e.stopPropagation())
}

let current: { menu: HTMLElement, button: HTMLElement, cleanup: () => void } | null = null

export function isTagMenuOpen(): boolean {
  return current !== null
}

export function closeTagMenu(): void {
  if (!current)
    return
  current.cleanup()
  current.menu.remove()
  current = null
}

export function openTagMenu(button: HTMLElement, onPick: (id: PlayerTagId) => void): void {
  if (current?.button === button) {
    closeTagMenu()
    return
  }
  closeTagMenu()

  const doc = button.ownerDocument
  const menu = doc.createElement('div')
  menu.className = MENU_CLASS
  for (const tag of PLAYER_TAGS) {
    const item = doc.createElement('div')
    item.className = 'ra2pt-menu-item'
    item.dataset.tag = tag.id
    const swatch = doc.createElement('span')
    swatch.className = 'ra2pt-swatch'
    swatch.style.background = tag.bg
    item.append(swatch, tag.label)
    item.addEventListener('click', () => {
      closeTagMenu()
      onPick(tag.id)
    })
    menu.appendChild(item)
  }
  swallowEvents(menu)

  // Fixed + body-level so ancestor overflow/z-index in the game UI cannot clip it.
  const rect = button.getBoundingClientRect()
  menu.style.left = `${Math.round(rect.left)}px`
  menu.style.top = `${Math.round(rect.bottom + 2)}px`
  doc.body.appendChild(menu)

  const onDocDown = (e: Event) => {
    const t = e.target as Node | null
    if (t && (menu.contains(t) || button.contains(t)))
      return
    closeTagMenu()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape')
      closeTagMenu()
  }
  doc.addEventListener('mousedown', onDocDown, true)
  doc.addEventListener('keydown', onKey, true)
  current = {
    menu,
    button,
    cleanup: () => {
      doc.removeEventListener('mousedown', onDocDown, true)
      doc.removeEventListener('keydown', onKey, true)
    },
  }
}
