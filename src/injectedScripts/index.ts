import { log } from './state/log'
import { loadClasses } from './system/loader'
import { patchPrototype } from './pip/patch'
import { announceReady, registerMessaging } from './bridge/messaging'
import { tracking } from './state/tracking'

declare global {
  interface Window {
    __ra2NamesInstalled?: boolean
    __ra2Units?: () => Array<[string, string]>
  }
}

;(() => {
  if (window.__ra2NamesInstalled) {
    log('already injected, skipping')
    return
  }
  window.__ra2NamesInstalled = true

  registerMessaging()

  // Console helper: dump discovered units.
  window.__ra2Units = () => {
    const entries = [...tracking.discoveredUnits.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
    // eslint-disable-next-line no-console
    console.table(Object.fromEntries(entries.map(([k, v]) => [k, { displayName: v }])))
    return entries
  }

  // Eager patch so units spawned at game start land in pipInstances before apply().
  loadClasses().then((ok) => {
    if (ok)
      patchPrototype()
  }).catch(() => {})

  announceReady()
  log('injected, awaiting commands')
})()
