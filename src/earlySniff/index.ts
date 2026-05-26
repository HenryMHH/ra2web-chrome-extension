// Runs at document_start in the MAIN world on Vite-bundled hosts (e.g. werhd / wangerhuoda).
// Goal: hook Object.freeze so we can intercept module namespace objects as the bundle freezes
// them, and stash references to engine classes that are otherwise sealed inside the IIFE.
//
// Step 1 PoC: just capture + log. Later steps will read window.__ra2_runtime from the regular
// injected script (loader-vite path).
;(() => {
  const TAG = '[ra2-early]'

  const TARGETS = ['PipOverlay', 'CrateGeneratorTrait', 'CanvasUtils', 'SpriteUtils', 'Coords'] as const
  type Target = typeof TARGETS[number]

  const stash = Object.create(null) as Record<Target, unknown>
  ;(window as any).__ra2_runtime = stash

  let pending = TARGETS.length
  const origFreeze = Object.freeze

  // Duck-type validation per slot. Same-named exports from unrelated modules would otherwise
  // poison the cache (e.g. some helper that happens to be named Coords).
  function looksValid(key: Target, v: unknown): boolean {
    if (v == null)
      return false
    switch (key) {
      case 'PipOverlay':
        return typeof v === 'function' && typeof (v as any).prototype?.create3DObject === 'function'
      case 'CrateGeneratorTrait':
        return typeof v === 'function'
          && typeof (v as any).prototype?.init === 'function'
          && typeof (v as any).prototype?.spawnCrateAt === 'function'
      case 'CanvasUtils':
        return typeof (v as any).drawText === 'function'
      case 'SpriteUtils':
        return typeof (v as any).createSpriteGeometry === 'function'
      case 'Coords':
        return typeof (v as any).tile3dToWorld === 'function'
    }
  }

  Object.freeze = function freezeHook(obj: any) {
    try {
      if (obj && typeof obj === 'object' && obj[Symbol.toStringTag] === 'Module' && pending > 0) {
        for (const key of TARGETS) {
          if (stash[key] !== undefined)
            continue
          if (!(key in obj))
            continue
          let val: unknown
          try {
            val = obj[key]
          }
          catch {
            continue
          }
          if (!looksValid(key, val))
            continue
          stash[key] = val
          pending--
          // eslint-disable-next-line no-console
          console.info(`${TAG} captured ${key}`, val)
          if (pending === 0) {
            // eslint-disable-next-line no-console
            console.info(`${TAG} all targets captured — restoring Object.freeze`)
            Object.freeze = origFreeze
            window.dispatchEvent(new CustomEvent('ra2-runtime-ready', { detail: { ...stash } }))
            break
          }
        }
      }
    }
    catch {
      // Never let our hook break the bundle.
    }
    return origFreeze(obj)
  }

  // Safety net: even if some target never gets captured, give the page back the original
  // Object.freeze after a while so we don't hold a perf cost forever.
  setTimeout(() => {
    if (Object.freeze !== origFreeze) {
      Object.freeze = origFreeze
      const missing = TARGETS.filter(k => stash[k] === undefined)

      console.warn(`${TAG} freeze hook timed out — missing:`, missing)
    }
  }, 30_000)

  // eslint-disable-next-line no-console
  console.info(`${TAG} freeze hook installed (document_start, MAIN world)`)
})()
