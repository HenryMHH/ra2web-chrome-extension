import type { PipOverlayLike } from '../types'
import { settings } from '../state/settings'
import { resolveTeam } from '../pip/resolvers'

export function shouldShowLabel(self: PipOverlayLike): boolean {
  if (!settings.enabled)
    return false
  const team = resolveTeam(self)
  if (team === 'neutral' && !settings.showNeutral)
    return false
  if (team === 'ally' && !settings.showAlly)
    return false
  if (team === 'enemy' && !settings.showEnemy)
    return false
  if (settings.shownUnits === 'all')
    return true
  const ruleName = self.gameObject?.rules?.name
  if (!ruleName)
    return false
  return settings.shownUnits.has(ruleName.toUpperCase())
}
