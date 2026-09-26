import { MENU_CLASS, closeTagMenu, openTagMenu } from './menu'
import { ANCHOR_CLASS, findNameSlots } from './slots'
import type { PlayerTagMap } from './store'
import { loadTags, onTagsChanged, removeTag, setTag } from './store'
import { ensureStyles } from './styles'
import type { WidgetHandlers } from './widget'
import { pruneWidgets, syncWidget } from './widget'

export interface PlayerTagsController {
  ready: Promise<void>
  scanNow: () => void
  stop: () => void
}

const OURS = `.${ANCHOR_CLASS}, .${MENU_CLASS}`

function isOurNode(n: Node): boolean {
  const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement
  return !!el?.closest(OURS)
}

// A mutation is ours if its target is inside our widget, or it only added/removed our nodes.
function isOwnMutation(m: MutationRecord): boolean {
  if (isOurNode(m.target))
    return true
  if (m.type !== 'childList')
    return false
  const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)]
  return nodes.length > 0 && nodes.every(n => n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(OURS))
}

export function startPlayerTags(doc: Document = document): PlayerTagsController {
  let tags: PlayerTagMap = {}
  let stopped = false
  let scheduled = false

  ensureStyles(doc)

  const handlers: WidgetHandlers = {
    onAdd(name, button) {
      openTagMenu(button, (id) => {
        tags = { ...tags, [name]: id }
        scanNow()
        setTag(name, id).catch(e => console.warn('[ra2-names] setTag failed:', e))
      })
    },
    onRemove(name) {
      tags = Object.fromEntries(Object.entries(tags).filter(([n]) => n !== name))
      scanNow()
      removeTag(name).catch(e => console.warn('[ra2-names] removeTag failed:', e))
    },
  }

  function scanNow() {
    if (stopped)
      return
    const keep = new Set<HTMLElement>()
    for (const slot of findNameSlots(doc))
      keep.add(syncWidget(slot, tags[slot.name], handlers))
    pruneWidgets(doc, keep)
  }

  function schedule() {
    if (scheduled || stopped)
      return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      scanNow()
    }, 16)
  }

  const observer = new MutationObserver((records) => {
    if (records.every(isOwnMutation))
      return
    schedule()
  })
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-r-tooltip', 'value', 'class'],
  })

  const offChanged = onTagsChanged((map) => {
    tags = map
    schedule()
  })

  const ready = loadTags()
    .then((map) => {
      tags = map
      scanNow()
    })
    .catch(e => console.warn('[ra2-names] loadTags failed:', e))

  function stop() {
    stopped = true
    observer.disconnect()
    offChanged()
    closeTagMenu()
    pruneWidgets(doc, new Set())
  }

  return { ready, scanNow, stop }
}
