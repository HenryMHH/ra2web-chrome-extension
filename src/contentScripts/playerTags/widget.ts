import { swallowEvents } from './menu'
import type { NameSlot } from './slots'
import { ANCHOR_CLASS } from './slots'
import { getPlayerTag, tagTextColor } from '~/constants/playerTags'
import type { PlayerTagDef, PlayerTagId } from '~/constants/playerTags'

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

function render(a: HTMLElement, def: PlayerTagDef | undefined): void {
  const doc = a.ownerDocument
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
    label.style.color = tagTextColor(def.bg)
    label.textContent = def.label
    inner.appendChild(label)
  }
  a.replaceChildren(inner)
}

export function syncWidget(
  slot: NameSlot,
  tag: PlayerTagId | undefined,
  handlers: WidgetHandlers,
  custom: readonly PlayerTagDef[] = [],
): HTMLElement {
  const a = findAnchor(slot) ?? createAnchor(slot)
  handlerMap.set(a, handlers)
  // Resolve here, not in render: an id with no def (a custom tag deleted elsewhere, an import
  // that brought assignments but not defs, corrupt storage) must behave as untagged end to end —
  // "+" shown AND data-tag empty, so the click handler opens the menu instead of calling
  // onRemove for a tag the user cannot see.
  const def = tag ? getPlayerTag(tag, custom) : undefined
  const tagAttr = def?.id ?? ''
  // Custom defs can change label/colour under the same id, so the id alone is not enough to
  // decide the DOM is current.
  const sig = def ? `${def.label}|${def.bg}` : ''
  if (a.dataset.name !== slot.name || a.dataset.tag !== tagAttr || a.dataset.sig !== sig || !a.firstElementChild) {
    a.dataset.name = slot.name
    a.dataset.tag = tagAttr
    a.dataset.sig = sig
    render(a, def)
  }
  return a
}

export function pruneWidgets(root: ParentNode, keep: Set<HTMLElement>): void {
  for (const a of Array.from(root.querySelectorAll<HTMLElement>(`.${ANCHOR_CLASS}`))) {
    if (!keep.has(a))
      a.remove()
  }
}
