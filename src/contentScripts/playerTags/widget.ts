import { swallowEvents } from './menu'
import type { NameSlot } from './slots'
import { ANCHOR_CLASS } from './slots'
import { getPlayerTag } from '~/constants/playerTags'
import type { PlayerTagId } from '~/constants/playerTags'

export interface WidgetHandlers {
  onAdd: (name: string, button: HTMLElement) => void
  onRemove: (name: string) => void
}

// Latest handlers per anchor, read at click time so listeners are bound only once.
const handlerMap = new WeakMap<HTMLElement, WidgetHandlers>()

function findAnchor(slot: NameSlot): HTMLElement | null {
  if (slot.mode === 'after-input') {
    const next = slot.host.nextElementSibling as HTMLElement | null
    return next?.classList.contains(ANCHOR_CLASS) ? next : null
  }
  return slot.host.querySelector<HTMLElement>(`:scope > .${ANCHOR_CLASS}`)
}

function createAnchor(slot: NameSlot): HTMLElement {
  const a = slot.host.ownerDocument.createElement('span')
  a.className = ANCHOR_CLASS
  a.dataset.mode = slot.mode
  swallowEvents(a)
  a.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('.ra2pt-btn')
    const h = handlerMap.get(a)
    if (!btn || !h)
      return
    const name = a.dataset.name!
    if (a.dataset.tag)
      h.onRemove(name)
    else
      h.onAdd(name, btn)
  })
  if (slot.mode === 'after-input')
    slot.host.insertAdjacentElement('afterend', a)
  else
    slot.host.appendChild(a)
  return a
}

function render(a: HTMLElement, tag: PlayerTagId | undefined): void {
  const doc = a.ownerDocument
  // getPlayerTag can return undefined for a stale/unknown id (defense in depth — should not
  // normally happen once tag maps are built with Object.create(null), but a corrupt/foreign
  // storage value must fall back to the untagged "+" state instead of throwing on def.bg).
  const def = tag ? getPlayerTag(tag) : undefined
  const inner = doc.createElement('span')
  inner.className = 'ra2pt-inner'
  const btn = doc.createElement('button')
  btn.type = 'button'
  btn.className = 'ra2pt-btn'
  btn.textContent = def ? '-' : '+'
  btn.title = def ? '移除標籤' : '標記玩家'
  inner.appendChild(btn)
  if (def) {
    const label = doc.createElement('span')
    label.className = 'ra2pt-tag'
    label.style.background = def.bg
    label.textContent = def.label
    inner.appendChild(label)
  }
  a.replaceChildren(inner)
}

export function syncWidget(slot: NameSlot, tag: PlayerTagId | undefined, handlers: WidgetHandlers): HTMLElement {
  const a = findAnchor(slot) ?? createAnchor(slot)
  handlerMap.set(a, handlers)
  const tagAttr = tag ?? ''
  if (a.dataset.name !== slot.name || a.dataset.tag !== tagAttr || !a.firstElementChild) {
    a.dataset.name = slot.name
    a.dataset.tag = tagAttr
    render(a, tag)
  }
  return a
}

export function pruneWidgets(root: ParentNode, keep: Set<HTMLElement>): void {
  for (const a of Array.from(root.querySelectorAll<HTMLElement>(`.${ANCHOR_CLASS}`))) {
    if (!keep.has(a))
      a.remove()
  }
}
