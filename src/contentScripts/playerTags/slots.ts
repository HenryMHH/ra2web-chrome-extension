export const ANCHOR_CLASS = 'ra2pt-anchor'

export type SlotMode = 'inline' | 'after-input'

export interface NameSlot {
  name: string
  host: HTMLElement
  mode: SlotMode
}

// Scoped to the three known screens so unrelated `.player-name` cells elsewhere are untouched.
const TABLE_SELECTOR = '.diplo-form td.player-name, .score-wrapper td.player-name'
const LOBBY_SLOT_SELECTOR = '.player-slots .player-slot:not(.player-slot-header)'

export function ownText(el: Element): string {
  let s = ''
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE)
      s += (n as Text).data
  }
  return s.trim()
}

function lobbySlot(slot: Element): NameSlot | null {
  // Empty ("開放"/"關閉") slots have a bare .rank-indicator; occupied ones carry a tooltip.
  if (!slot.querySelector('.rank-indicator[data-r-tooltip]'))
    return null
  const nameEl = slot.querySelector<HTMLElement>('.player-name')
  if (!nameEl)
    return null
  if (nameEl instanceof HTMLInputElement) {
    const name = nameEl.value.trim()
    return name ? { name, host: nameEl, mode: 'after-input' } : null
  }
  const inner = nameEl.querySelector<HTMLElement>('.select-value > div')
  if (!inner)
    return null
  const name = ownText(inner)
  return name ? { name, host: inner, mode: 'inline' } : null
}

export function findNameSlots(root: ParentNode = document): NameSlot[] {
  const out: NameSlot[] = []
  for (const td of Array.from(root.querySelectorAll<HTMLElement>(TABLE_SELECTOR))) {
    const name = ownText(td)
    if (name)
      out.push({ name, host: td, mode: 'inline' })
  }
  for (const slot of Array.from(root.querySelectorAll(LOBBY_SLOT_SELECTOR))) {
    const s = lobbySlot(slot)
    if (s)
      out.push(s)
  }
  return out
}
