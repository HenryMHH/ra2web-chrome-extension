import type { LabelCache, PipOverlayLike } from '../types'

export interface Tracking {
  patched: boolean
  pipInstances: Set<PipOverlayLike>
  discoveredUnits: Map<string, string>
  lastPipUpdateTime: number
  origCreate: ((...a: any[]) => any) | null
  origUpdate: ((...a: any[]) => any) | null
  origDispose: ((...a: any[]) => any) | null
}

export const tracking: Tracking = {
  patched: false,
  pipInstances: new Set<PipOverlayLike>(),
  discoveredUnits: new Map<string, string>(),
  lastPipUpdateTime: 0,
  origCreate: null,
  origUpdate: null,
  origDispose: null,
}

export const labelCache = new WeakMap<PipOverlayLike, LabelCache>()
