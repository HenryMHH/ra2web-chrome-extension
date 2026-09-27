import { MENU_CLASS, closeTagMenu, openTagMenu } from './menu'
import { ANCHOR_CLASS, findNameSlots } from './slots'
import type { PlayerTagMap } from './store'
import {
  cloneTagMap,
  emptyTagMap,
  loadCustomTags,
  loadTags,
  onCustomTagsChanged,
  onTagsChanged,
  removeTag,
  setTag,
} from './store'
import { ensureStyles } from './styles'
import type { WidgetHandlers } from './widget'
import { pruneWidgets, syncWidget } from './widget'
import type { PlayerTagDef } from '~/constants/playerTags'
import { allPlayerTags } from '~/constants/playerTags'

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

// document.body can be missing very early in the page lifecycle (observed on some all_frames
// frames). MutationObserver.observe() throws synchronously against a null target, and a throw
// here would otherwise abort the whole content-script bootstrap. Rather than deferring to
// DOMContentLoaded (more moving parts, and this feature is best-effort), just no-op: the game
// UI this feature targets never exists before <body> does anyway, so there is nothing to scan.
function noopController(): PlayerTagsController {
  return { ready: Promise.resolve(), scanNow: () => {}, stop: () => {} }
}

export function startPlayerTags(doc: Document = document): PlayerTagsController {
  if (!doc.body) {
    console.warn('[ra2-names] player tags: document.body not available, skipping')
    return noopController()
  }

  let tags: PlayerTagMap = emptyTagMap()
  let customTags: PlayerTagDef[] = []
  let stopped = false
  let scheduled = false

  ensureStyles(doc)

  // On a rejected write, the optimistic local state may now disagree with storage — reload the
  // authoritative map and re-render rather than leaving the UI stuck showing the unsaved change.
  function reloadFromStorage() {
    Promise.all([loadTags(), loadCustomTags()]).then(([map, list]) => {
      tags = map
      customTags = list
      scanNow()
    })
  }

  const handlers: WidgetHandlers = {
    onAdd(name, button) {
      openTagMenu(button, (id) => {
        tags = cloneTagMap(tags)
        tags[name] = id
        scanNow()
        setTag(name, id).catch((e) => {
          console.warn('[ra2-names] setTag failed:', e)
          reloadFromStorage()
        })
      }, allPlayerTags(customTags))
    },
    onRemove(name) {
      tags = cloneTagMap(tags)
      delete tags[name]
      scanNow()
      removeTag(name).catch((e) => {
        console.warn('[ra2-names] removeTag failed:', e)
        reloadFromStorage()
      })
    },
  }

  function scanNow() {
    if (stopped)
      return
    const keep = new Set<HTMLElement>()
    for (const slot of findNameSlots(doc)) {
      try {
        keep.add(syncWidget(slot, tags[slot.name], handlers, customTags))
      }
      catch (e) {
        // One malformed slot/tag must not stop the rest of the scan (and skipping pruneWidgets
        // below) — log and keep going.
        console.warn('[ra2-names] syncWidget failed for player:', slot.name, e)
      }
    }
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

  const offCustomChanged = onCustomTagsChanged((list) => {
    customTags = list
    schedule()
  })

  const ready = Promise.all([loadTags(), loadCustomTags()])
    .then(([map, list]) => {
      tags = map
      customTags = list
      scanNow()
    })
    .catch(e => console.warn('[ra2-names] loadTags failed:', e))

  function stop() {
    stopped = true
    observer.disconnect()
    offChanged()
    offCustomChanged()
    closeTagMenu()
    pruneWidgets(doc, new Set())
  }

  return { ready, scanNow, stop }
}
