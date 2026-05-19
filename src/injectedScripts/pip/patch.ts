import type { PipOverlayLike } from '../types'
import { runtime } from '../state/runtime'
import { labelCache, tracking } from '../state/tracking'
import { log, warn } from '../state/log'
import { shouldShowLabel } from '../label/policy'
import { attachLabel, detachLabel, refreshLabel } from '../label/lifecycle'
import { resolveName } from './resolvers'

export function patchPrototype(): void {
  if (tracking.patched)
    return
  if (!runtime.PipOverlay)
    return
  const P = runtime.PipOverlay
  tracking.origCreate = P.prototype.create3DObject
  tracking.origUpdate = P.prototype.update
  tracking.origDispose = P.prototype.dispose

  P.prototype.create3DObject = function (this: PipOverlayLike, ...args: any[]) {
    const ret = tracking.origCreate ? tracking.origCreate.apply(this, args) : undefined
    try {
      (this as any).__unameLblTracked = true
      tracking.pipInstances.add(this)
      captureRefs(this)
      const ruleName = this.gameObject?.rules?.name
      if (ruleName && !tracking.discoveredUnits.has(ruleName)) {
        const displayName = resolveName(this) ?? ruleName
        tracking.discoveredUnits.set(ruleName, displayName)
        log('unit discovered:', ruleName, '→', displayName)
      }
      if (shouldShowLabel(this))
        attachLabel(this)
    }
    catch (e) {
      warn('create patch:', e)
    }
    return ret
  }

  P.prototype.update = function (this: PipOverlayLike, ...args: any[]) {
    let ret
    try {
      ret = tracking.origUpdate ? tracking.origUpdate.apply(this, args) : undefined
    }
    catch {}
    try {
      tracking.lastPipUpdateTime = performance.now()
      if (!(this as any).__unameLblTracked) {
        (this as any).__unameLblTracked = true
        tracking.pipInstances.add(this)
      }
      captureRefs(this)
      if (!shouldShowLabel(this)) {
        detachLabel(this)
        return ret
      }
      if (!labelCache.has(this))
        attachLabel(this)
      else refreshLabel(this)
    }
    catch (e) {
      warn('update patch:', e)
    }
    return ret
  }

  P.prototype.dispose = function (this: PipOverlayLike, ...args: any[]) {
    try {
      detachLabel(this)
      tracking.pipInstances.delete(this)
    }
    catch (e) {
      warn('dispose patch:', e)
    }
    if (tracking.origDispose)
      return tracking.origDispose.apply(this, args)
  }

  tracking.patched = true
  log('PipOverlay.prototype patched')
}

function captureRefs(self: PipOverlayLike): void {
  if (self.camera)
    runtime.activeCamera = self.camera
  if (self.alliances)
    runtime.alliances = self.alliances
  if (self.viewer)
    runtime.viewer = self.viewer
  if (self.strings)
    runtime.strings = self.strings
}
