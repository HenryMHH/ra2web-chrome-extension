import type { ApplyOpts, ApplyResult, PipOverlayLike } from '../types'
import { runtime } from '../state/runtime'
import { settings } from '../state/settings'
import { labelCache, tracking } from '../state/tracking'
import { overlayState } from '../state/overlay'
import { log, warn } from '../state/log'
import { loadClasses } from '../system/loader'
import { patchPrototype } from '../pip/patch'
import { attachLabel } from '../label/lifecycle'
import { sweepLeftoverLabels } from '../label/sweep'
import { shouldShowLabel } from '../label/policy'
import { initOverlay, removeOverlay } from '../overlay/canvas'
import { drawOverlay } from '../overlay/draw'
import { getUnitNames } from '../rules/enumerate'

declare const System: any

export async function apply(opts: ApplyOpts): Promise<ApplyResult> {
  settings.enabled = !!opts.enabled
  settings.showNeutral = !!opts.showNeutral
  settings.showAlly = opts.showAlly !== false
  settings.showEnemy = opts.showEnemy !== false
  settings.showIndicators = !!opts.showIndicators
  settings.enabledCrateTypes = new Set(
    Array.isArray(opts.enabledCrateTypes)
      ? opts.enabledCrateTypes.map(Number).filter(Number.isFinite)
      : [],
  )
  if (opts.shownUnits === 'all') {
    settings.shownUnits = 'all'
  }
  else if (Array.isArray(opts.shownUnits)) {
    settings.shownUnits = new Set(opts.shownUnits.map(s => String(s).toUpperCase()))
  }
  else {
    settings.shownUnits = 'all'
  }
  if (typeof opts.fontSize === 'number' && opts.fontSize >= 10 && opts.fontSize <= 20) {
    settings.fontSize = opts.fontSize
  }
  else {
    warn('apply: invalid fontSize', opts.fontSize, '— using 14')
    settings.fontSize = 14
  }

  const needPatch = settings.enabled || settings.showIndicators || settings.enabledCrateTypes.size > 0
  if (needPatch) {
    const ok = await loadClasses()
    if (!ok)
      return { ok: false, error: 'modules not available' }
    patchPrototype()
  }

  if (settings.enabled) {
    let attached = 0
    for (const pip of tracking.pipInstances) {
      try {
        if (!labelCache.has(pip) && shouldShowLabel(pip as PipOverlayLike)) {
          attachLabel(pip as PipOverlayLike)
          attached++
        }
      }
      catch {}
    }
    log(`apply: labels enabled, attached ${attached}/${tracking.pipInstances.size} instances`)
  }
  else {
    await sweepLeftoverLabels()
    log('apply: labels disabled, swept')
  }

  const needOverlay = settings.showIndicators || settings.enabledCrateTypes.size > 0
  if (needOverlay) {
    initOverlay()
    if (overlayState.rafId !== null) {
      cancelAnimationFrame(overlayState.rafId)
      overlayState.rafId = null
    }
    drawOverlay()
    log(`apply: overlay enabled (indicators=${settings.showIndicators}, crateTypes=${settings.enabledCrateTypes.size})`)
  }
  else {
    removeOverlay()
    log('apply: overlay disabled')
  }

  return {
    ok: true,
    state: {
      enabled: settings.enabled,
      showNeutral: settings.showNeutral,
      showAlly: settings.showAlly,
      showEnemy: settings.showEnemy,
      showIndicators: settings.showIndicators,
      enabledCrateTypes: [...settings.enabledCrateTypes],
      fontSize: settings.fontSize,
    },
  }
}

export function getStatus() {
  return {
    injected: true,
    patched: tracking.patched,
    classesReady: !!(runtime.PipOverlay && runtime.CanvasUtils && runtime.SpriteUtils && runtime.Coords),
    enabled: settings.enabled,
    showNeutral: settings.showNeutral,
    showAlly: settings.showAlly,
    showEnemy: settings.showEnemy,
    showIndicators: settings.showIndicators,
    enabledCrateTypes: [...settings.enabledCrateTypes],
    fontSize: settings.fontSize,
    systemAvailable: typeof System !== 'undefined' && !!System.import,
    threeAvailable: typeof (globalThis as any).THREE !== 'undefined',
  }
}

export const handlers = {
  apply,
  status: getStatus,
  getUnitNames,
}

export type HandlerName = keyof typeof handlers
