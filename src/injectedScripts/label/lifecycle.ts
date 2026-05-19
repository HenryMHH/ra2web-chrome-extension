import type { PipOverlayLike } from '../types'
import { labelCache } from '../state/tracking'
import { resolveName, resolveTeam } from '../pip/resolvers'
import { settings } from '../state/settings'
import { buildLabel } from './build'

export function attachLabel(self: PipOverlayLike): void {
  if (!self.rootObj || labelCache.has(self))
    return
  const lbl = buildLabel(self)
  if (!lbl)
    return
  labelCache.set(self, lbl)
  self.rootObj.add(lbl.mesh)
  self.rootObj.matrixWorldNeedsUpdate = true
}

export function refreshLabel(self: PipOverlayLike): void {
  if (!self.rootObj)
    return
  const cache = labelCache.get(self)
  const newName = resolveName(self)
  const newOwner = self.gameObject?.owner
  const newTeam = resolveTeam(self)
  const newFontSize = settings.fontSize

  if (cache
    && cache.text === newName
    && cache.owner === newOwner
    && cache.team === newTeam
    && cache.fontSize === newFontSize) {
    return
  }

  if (cache) {
    self.rootObj.remove(cache.mesh)
    cache.dispose()
    labelCache.delete(self)
  }

  if (newName) {
    const lbl = buildLabel(self)
    if (lbl) {
      labelCache.set(self, lbl)
      self.rootObj.add(lbl.mesh)
      self.rootObj.matrixWorldNeedsUpdate = true
    }
    // buildLabel returned null → leave cache empty; next frame retries.
  }
}

export function detachLabel(self: PipOverlayLike): void {
  const cache = labelCache.get(self)
  if (!cache)
    return
  if (self.rootObj)
    self.rootObj.remove(cache.mesh)
  cache.dispose()
  labelCache.delete(self)
}
