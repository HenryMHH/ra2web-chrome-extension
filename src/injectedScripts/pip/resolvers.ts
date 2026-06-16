import type { GameObjectLike, PipOverlayLike, Team } from '../types'
import { runtime } from '../state/runtime'

export function resolveTeam(self: PipOverlayLike): Team {
  try {
    const local = self.viewer?.value
    const owner = self.gameObject?.owner
    if (!local || !owner)
      return 'unknown'
    if ((owner as any).isNeutral)
      return 'neutral'
    if (owner === local)
      return 'self'
    if (self.alliances?.areAllied(owner, local))
      return 'ally'
    return 'enemy'
  }
  catch {
    return 'unknown'
  }
}

export function resolveName(self: PipOverlayLike): string | null {
  try {
    const rules = self.gameObject?.rules
    if (!rules)
      return null
    const key = rules.uiName
    let baseName: string | null = null
    if (key && self.strings && typeof self.strings.get === 'function') {
      const v = self.strings.get(key)
      if (v && v !== key)
        baseName = v
    }
    if (baseName === null)
      baseName = rules.name ?? null
    if (baseName === null)
      return null

    const cb = self.gameObject?.crateBonuses
    if (!cb)
      return baseName
    let suffix = ''
    if (cb.firepower > 1)
      suffix = 'P'
    if (cb.armor > 1)
      suffix = suffix ? `${suffix}/D` : 'D'
    if (cb.speed > 1)
      suffix = suffix ? `${suffix}/S` : 'S'
    return suffix ? `${baseName}(${suffix})` : baseName
  }
  catch {
    return null
  }
}

export function resolveNameFromGo(go: GameObjectLike): string | null {
  try {
    const rules = go.rules
    if (!rules)
      return null
    const key = rules.uiName
    if (key && runtime.strings && typeof runtime.strings.get === 'function') {
      const v = runtime.strings.get(key)
      if (v && v !== key)
        return v
    }
    return rules.name ?? null
  }
  catch {
    return null
  }
}
