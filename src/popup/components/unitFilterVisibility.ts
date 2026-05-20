// Module-level singleton for UnitFilter visibility refetch.
//
// In production there is only ever one popup/sidepanel instance of UnitFilter,
// so a singleton handler is correct. We use a single document listener and
// delegate to whichever instance is currently mounted; this also means stale
// instances (e.g. across test cases that don't explicitly unmount) won't
// re-trigger fetches.
let currentVisibilityHandler: (() => void) | null = null
let visibilityListenerInstalled = false

export function setVisibilityHandler(handler: (() => void) | null): void {
  currentVisibilityHandler = handler
}

export function isCurrentVisibilityHandler(handler: () => void): boolean {
  return currentVisibilityHandler === handler
}

export function ensureVisibilityListener(): void {
  if (visibilityListenerInstalled)
    return
  visibilityListenerInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentVisibilityHandler)
      currentVisibilityHandler()
  })
}
