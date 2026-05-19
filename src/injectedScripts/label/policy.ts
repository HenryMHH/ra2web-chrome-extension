import type { PipOverlayLike } from '../types'
import { settings } from '../state/settings'
import { resolveTeam } from '../pip/resolvers'

export function shouldShowLabel(self: PipOverlayLike): boolean {
  if (!settings.enabled)
    return false
  const team = resolveTeam(self)
  if (team === 'neutral' && !settings.showNeutral)
    return false
  const ruleName = self.gameObject?.rules?.name
  if (ruleName && settings.hiddenUnits.has(ruleName.toUpperCase()))
    return false
  return true
}
